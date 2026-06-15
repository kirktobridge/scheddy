import { addDays, format, isWeekend, startOfDay } from 'date-fns'
import type { GEvent } from '../api/calendar'
import { fmtTime } from './format'

/** A window's name doubles as its identity and display label. */
export type WindowKey = string

export interface TimeWindow {
  /** "HH:mm" */
  start: string
  end: string
}

export type Windows = Record<WindowKey, TimeWindow>

export const DEFAULT_WINDOWS: Windows = {
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '22:00' },
}

/** Window names ordered by start time (then name) for stable display. */
export function windowKeys(windows: Windows): WindowKey[] {
  return Object.keys(windows).sort(
    (a, b) => windows[a].start.localeCompare(windows[b].start) || a.localeCompare(b),
  )
}

export interface BusyInterval {
  start: Date
  end: Date
}

export interface Slot {
  /** yyyy-MM-dd */
  date: string
  window: WindowKey
  /** Longest contiguous free stretch within the window. */
  freeFrom: Date
  freeTo: Date
  fullyFree: boolean
  /** Longest free stretch as a fraction of the full window length. */
  freeRatio: number
  /** Set when a work event trims the front of the free stretch (see adjustForWork). */
  freeAfterWork?: boolean
}

export function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime())
  const merged: BusyInterval[] = []
  for (const cur of sorted) {
    const last = merged[merged.length - 1]
    if (last && cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) last.end = cur.end
    } else {
      merged.push({ start: cur.start, end: cur.end })
    }
  }
  return merged
}

/**
 * Converts calendar events to merged busy intervals. Transparent ("Free") and
 * cancelled events never block time. All-day events (bill reminders etc.) block
 * only when `opts.allDay` is set — a per-rule override can flip individual ones
 * (see applyRuleOverrides), so callers pass the global default here.
 */
export function eventsToBusy(events: GEvent[], opts: { allDay?: boolean } = {}): BusyInterval[] {
  const busy: BusyInterval[] = []
  for (const ev of events) {
    if (ev.status === 'cancelled') continue
    if (ev.transparency === 'transparent') continue
    if (ev.start?.dateTime && ev.end?.dateTime) {
      const start = new Date(ev.start.dateTime)
      const end = new Date(ev.end.dateTime)
      if (end.getTime() <= start.getTime()) continue
      busy.push({ start, end })
    } else if (opts.allDay && ev.start?.date && ev.end?.date) {
      // Google encodes all-day end.date as exclusive (next midnight).
      const start = new Date(ev.start.date + 'T00:00:00')
      const end = new Date(ev.end.date + 'T00:00:00')
      if (end.getTime() <= start.getTime()) continue
      busy.push({ start, end })
    }
  }
  return mergeIntervals(busy)
}

export function atTime(day: Date, hm: string): Date {
  const [h, m] = hm.split(':').map(Number)
  const out = new Date(day)
  out.setHours(h, m, 0, 0)
  return out
}

/** Free sub-intervals of [from, to) after removing merged busy intervals. */
export function freeGaps(busy: BusyInterval[], from: Date, to: Date): BusyInterval[] {
  const gaps: BusyInterval[] = []
  let cursor = from
  for (const b of busy) {
    if (b.end.getTime() <= cursor.getTime()) continue
    if (b.start.getTime() >= to.getTime()) break
    if (b.start.getTime() > cursor.getTime()) {
      gaps.push({ start: cursor, end: b.start })
    }
    if (b.end.getTime() > cursor.getTime()) cursor = b.end
  }
  if (cursor.getTime() < to.getTime()) gaps.push({ start: cursor, end: to })
  return gaps
}

export interface FindOpts {
  /** Fraction of the window that must be contiguously free. Default 0.75. */
  threshold?: number
  /** Slots (or parts of slots) before this moment don't count. */
  now?: Date
  windowFilter?: WindowKey[]
}

/**
 * Scans each day in [rangeStart, rangeEnd] and returns the window slots
 * (morning/afternoon/evening) whose longest contiguous free stretch is at
 * least `threshold` of the window. `busy` must be merged (use eventsToBusy).
 */
export function findFreeSlots(
  busy: BusyInterval[],
  windows: Windows,
  rangeStart: Date,
  rangeEnd: Date,
  opts: FindOpts = {},
): Slot[] {
  const threshold = opts.threshold ?? 0.75
  const now = opts.now ?? rangeStart
  const keys = opts.windowFilter ?? windowKeys(windows)
  const slots: Slot[] = []

  for (let day = startOfDay(rangeStart); day.getTime() <= rangeEnd.getTime(); day = addDays(day, 1)) {
    for (const key of keys) {
      const win = windows[key]
      if (!win) continue
      const ws = atTime(day, win.start)
      const we = atTime(day, win.end)
      const windowLen = we.getTime() - ws.getTime()
      if (windowLen <= 0) continue

      const effStart = new Date(Math.max(ws.getTime(), now.getTime(), rangeStart.getTime()))
      const effEnd = new Date(Math.min(we.getTime(), rangeEnd.getTime()))
      if (effEnd.getTime() <= effStart.getTime()) continue

      const gaps = freeGaps(busy, effStart, effEnd)
      if (gaps.length === 0) continue
      const longest = gaps.reduce((a, b) =>
        b.end.getTime() - b.start.getTime() > a.end.getTime() - a.start.getTime() ? b : a,
      )
      const longestLen = longest.end.getTime() - longest.start.getTime()
      const freeRatio = longestLen / windowLen
      if (freeRatio + 1e-9 < threshold) continue

      slots.push({
        date: format(day, 'yyyy-MM-dd'),
        window: key,
        freeFrom: longest.start,
        freeTo: longest.end,
        fullyFree: longest.start.getTime() === ws.getTime() && longest.end.getTime() === we.getTime(),
        freeRatio,
      })
    }
  }
  return slots
}

/** Every yyyy-MM-dd touched by a busy interval (all-day spans cover each day). */
export function blockedDates(busy: BusyInterval[]): Set<string> {
  const dates = new Set<string>()
  for (const b of busy) {
    for (let day = startOfDay(b.start); day.getTime() < b.end.getTime(); day = addDays(day, 1)) {
      dates.add(format(day, 'yyyy-MM-dd'))
    }
  }
  return dates
}

/**
 * How far (in days) the nearest blocking event sits from `date`, looking up to
 * `n` days each way and taking the smaller side. Each direction defaults to `n`
 * when nothing's blocked within the window (the "max window of concern"), so a
 * day with clear calendar on both sides scores `n`. `n <= 0` disables it (0).
 */
export function dayIsolation(date: string, blocked: Set<string>, n: number): number {
  if (n <= 0) return 0
  const base = new Date(date + 'T12:00:00')
  const reach = (dir: 1 | -1): number => {
    for (let k = 1; k <= n; k++) {
      if (blocked.has(format(addDays(base, dir * k), 'yyyy-MM-dd'))) return k
    }
    return n
  }
  return Math.min(reach(-1), reach(1))
}

export interface RankOpts {
  count: number
  isolationWindow: number
  favorWeekends: boolean
}

/**
 * Ranks free days for the "top N" picks, lexicographically: most isolated from
 * other blocking events first, then most total free time (bucketed to 30 min so
 * weekends can still break realistic ties), then weekends. Returns the top
 * `count`, re-sorted by date for calendar display.
 */
export function rankFreeDays(
  entries: [string, Slot[]][],
  blocked: Set<string>,
  opts: RankOpts,
): [string, Slot[]][] {
  const freeMs = (s: Slot[]) => s.reduce((sum, x) => sum + (x.freeTo.getTime() - x.freeFrom.getTime()), 0)
  const HALF_HOUR = 30 * 60 * 1000
  const freeBucket = (s: Slot[]) => Math.round(freeMs(s) / HALF_HOUR)
  const weekendRank = (date: string) => (isWeekend(new Date(date + 'T12:00:00')) ? 1 : 0)
  return [...entries]
    .sort(([da, sa], [db, sb]) => {
      return (
        dayIsolation(db, blocked, opts.isolationWindow) - dayIsolation(da, blocked, opts.isolationWindow) ||
        freeBucket(sb) - freeBucket(sa) ||
        (opts.favorWeekends ? weekendRank(db) - weekendRank(da) : 0) ||
        da.localeCompare(db)
      )
    })
    .slice(0, opts.count)
    .sort(([da], [db]) => da.localeCompare(db))
}

/**
 * The waking-day span for a date: from `dayStart` (falling back to the first
 * window's start) to the last window's end. `dayStart` both extends the span
 * earlier and clips it later — availability before it is never shown. Returns
 * null when there are no windows or the span is empty (dayStart at/after the
 * last window's end).
 */
export function daySpan(
  windows: Windows,
  date: string,
  dayStart?: string,
): { start: Date; end: Date } | null {
  const keys = windowKeys(windows)
  if (keys.length === 0) return null
  const day = new Date(date + 'T00:00:00')
  const firstStart = windows[keys[0]].start
  const startHM = dayStart ?? firstStart
  const start = atTime(day, startHM)
  const end = atTime(day, windows[keys[keys.length - 1]].end)
  if (end.getTime() <= start.getTime()) return null
  return { start, end }
}

export interface TimelineSeg {
  kind: 'free' | 'busy'
  /** Position within the day span, 0–1. */
  startFrac: number
  endFrac: number
}

export interface DayTimeline {
  /** Ordered, non-overlapping segments covering [0, 1] of the day span. */
  segments: TimelineSeg[]
  /** Fraction already past (0 unless `now` falls inside today's span). */
  nowFrac: number
  /** Window-boundary times for the axis, e.g. 8a / 12p / 5p / 10p. */
  ticks: { frac: number; label: string }[]
}

/**
 * Builds the availability-bar geometry for one day: free vs busy stretches
 * across the span from the earliest window start to the latest window end.
 * `busy` should be the combined merged busy (non-work ∪ work) — work counts
 * as busy so "free after work" evenings render as busy-then-free.
 */
export function dayTimeline(
  busy: BusyInterval[],
  windows: Windows,
  date: string,
  now?: Date,
  /** Clock time ("HH:mm") the bar starts at; hides any availability before it. */
  dayStart?: string,
): DayTimeline {
  const keys = windowKeys(windows)
  const day = new Date(date + 'T00:00:00')
  const empty: DayTimeline = { segments: [], nowFrac: 0, ticks: [] }
  const span = daySpan(windows, date, dayStart)
  if (!span) return empty

  const { start: spanStart, end: spanEnd } = span
  const spanLen = spanEnd.getTime() - spanStart.getTime()

  const frac = (d: Date) => Math.min(1, Math.max(0, (d.getTime() - spanStart.getTime()) / spanLen))

  // Free stretches → emit alternating busy/free segments covering the span.
  const free = freeGaps(busy, spanStart, spanEnd)
  const segments: TimelineSeg[] = []
  let cursor = 0
  for (const gap of free) {
    const s = frac(gap.start)
    const e = frac(gap.end)
    if (s > cursor) segments.push({ kind: 'busy', startFrac: cursor, endFrac: s })
    if (e > s) segments.push({ kind: 'free', startFrac: s, endFrac: e })
    cursor = e
  }
  if (cursor < 1) segments.push({ kind: 'busy', startFrac: cursor, endFrac: 1 })

  const nowFrac = now ? frac(now) : 0

  // Tick at the span start, each window start that falls inside the span, then span end.
  const ticks: { frac: number; label: string }[] = [{ frac: 0, label: fmtTime(spanStart) }]
  for (const k of keys) {
    const t = atTime(day, windows[k].start)
    if (t.getTime() <= spanStart.getTime() || t.getTime() >= spanEnd.getTime()) continue
    ticks.push({ frac: frac(t), label: fmtTime(t) })
  }
  ticks.push({ frac: 1, label: fmtTime(spanEnd) })

  return { segments, nowFrac, ticks }
}
