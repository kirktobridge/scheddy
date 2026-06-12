import { addDays, format, startOfDay } from 'date-fns'
import type { GEvent } from '../api/calendar'

export type WindowKey = 'morning' | 'afternoon' | 'evening'
export const WINDOW_KEYS: WindowKey[] = ['morning', 'afternoon', 'evening']

export interface TimeWindow {
  /** "HH:mm" */
  start: string
  end: string
}

export type Windows = Record<WindowKey, TimeWindow>

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
 * Converts calendar events to merged busy intervals. All-day events
 * (bill reminders etc.), transparent ("Free") events, and cancelled
 * events never block time.
 */
export function eventsToBusy(events: GEvent[]): BusyInterval[] {
  const busy: BusyInterval[] = []
  for (const ev of events) {
    if (ev.status === 'cancelled') continue
    if (ev.transparency === 'transparent') continue
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue
    const start = new Date(ev.start.dateTime)
    const end = new Date(ev.end.dateTime)
    if (end.getTime() <= start.getTime()) continue
    busy.push({ start, end })
  }
  return mergeIntervals(busy)
}

function atTime(day: Date, hm: string): Date {
  const [h, m] = hm.split(':').map(Number)
  const out = new Date(day)
  out.setHours(h, m, 0, 0)
  return out
}

/** Free sub-intervals of [from, to) after removing merged busy intervals. */
function freeGaps(busy: BusyInterval[], from: Date, to: Date): BusyInterval[] {
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
  const keys = opts.windowFilter ?? WINDOW_KEYS
  const slots: Slot[] = []

  for (let day = startOfDay(rangeStart); day.getTime() <= rangeEnd.getTime(); day = addDays(day, 1)) {
    for (const key of keys) {
      const win = windows[key]
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
