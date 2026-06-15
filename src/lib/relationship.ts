import { addDays, differenceInCalendarDays, format, isWeekend, startOfDay, startOfWeek } from 'date-fns'
import type { GEvent } from '../api/calendar'
import {
  blockedDates,
  dayIsolation,
  daySpan,
  freeGaps,
  mergeIntervals,
  type BusyInterval,
  type Windows,
} from './availability'

/** yyyy-MM-dd for every day in [start, end] (inclusive). */
export function datesInRange(start: Date, end: Date): string[] {
  const out: string[] = []
  for (let d = startOfDay(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    out.push(format(d, 'yyyy-MM-dd'))
  }
  return out
}

/** Longest interval in a list, in ms (0 when empty). */
export function longestGapMs(gaps: BusyInterval[]): number {
  let max = 0
  for (const g of gaps) max = Math.max(max, g.end.getTime() - g.start.getTime())
  return max
}

/**
 * Free stretches both partners share within [from, to). A moment is free for
 * both iff it is busy for neither, so the mutual-free time is exactly the free
 * gaps of the union of both busy sets.
 */
export function overlapFreeGaps(
  myBusy: BusyInterval[],
  partnerBusy: BusyInterval[],
  from: Date,
  to: Date,
): BusyInterval[] {
  return freeGaps(mergeIntervals([...myBusy, ...partnerBusy]), from, to)
}

/** Longest mutual free stretch (ms) for a date, measured over its waking-day span. */
export function overlapLongestMs(
  myBusy: BusyInterval[],
  partnerBusy: BusyInterval[],
  windows: Windows,
  date: string,
  dayStart?: string,
): number {
  const span = daySpan(windows, date, dayStart)
  if (!span) return 0
  return longestGapMs(overlapFreeGaps(myBusy, partnerBusy, span.start, span.end))
}

/** Map of date → longest mutual free stretch (ms), for each requested date. */
export function overlapByDate(
  myBusy: BusyInterval[],
  partnerBusy: BusyInterval[],
  windows: Windows,
  dates: string[],
  dayStart?: string,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const date of dates) {
    out.set(date, overlapLongestMs(myBusy, partnerBusy, windows, date, dayStart))
  }
  return out
}

/** Dates from `overlap` whose longest mutual free stretch is at least `minMs`. */
export function overlapDates(overlap: Map<string, number>, minMs: number): Set<string> {
  const out = new Set<string>()
  for (const [date, ms] of overlap) if (ms + 1e-9 >= minMs) out.add(date)
  return out
}

/** Active dates where the partner isn't working (no work-calendar event that day). */
export function notWorkingDates(partnerWorkBusy: BusyInterval[], dates: string[]): Set<string> {
  const working = blockedDates(partnerWorkBusy)
  return new Set(dates.filter((d) => !working.has(d)))
}

/** Week bucket (the week's Sunday, yyyy-MM-dd) a date falls in. */
export function weekKey(date: string): string {
  return format(startOfWeek(new Date(date + 'T12:00:00')), 'yyyy-MM-dd')
}

/** Week buckets that already contain at least one scheduled date event. */
export function weeksWithDateEvent(dateEvents: GEvent[]): Set<string> {
  const out = new Set<string>()
  for (const ev of dateEvents) {
    if (ev.status === 'cancelled') continue
    const iso = ev.start?.dateTime ?? (ev.start?.date ? ev.start.date + 'T00:00:00' : null)
    if (!iso) continue
    out.add(format(startOfWeek(new Date(iso)), 'yyyy-MM-dd'))
  }
  return out
}

export interface DateRankOpts {
  count: number
  isolationWindow: number
  /** Day-type bias: prefer weekends, prefer weekdays, or treat both equally. */
  preference: 'weekend' | 'weekday' | 'either'
}

/**
 * Picks date candidates, at most one per week and never on back-to-back days.
 * Candidates are first ranked lexicographically — most isolated from any
 * blocking event (distance from either partner's commitments), then the
 * configured day-type bias, then most mutual free time, then earliest — and then
 * walked best-first: a day is taken only if its week has no pick yet and it isn't
 * adjacent to one already taken. So each week contributes its single best day,
 * spaced out from the others. Returns up to `count` picks.
 */
export function rankDateCandidates(
  eligible: string[],
  overlap: Map<string, number>,
  blocked: Set<string>,
  opts: DateRankOpts,
): string[] {
  const isWknd = (date: string) => (isWeekend(new Date(date + 'T12:00:00')) ? 1 : 0)
  // +1 to a day in the preferred bucket so it sorts ahead; 0 when no preference.
  const dayBias = (date: string) =>
    opts.preference === 'weekend' ? isWknd(date) : opts.preference === 'weekday' ? 1 - isWknd(date) : 0
  const ranked = [...eligible].sort(
    (a, b) =>
      dayIsolation(b, blocked, opts.isolationWindow) - dayIsolation(a, blocked, opts.isolationWindow) ||
      dayBias(b) - dayBias(a) ||
      (overlap.get(b) ?? 0) - (overlap.get(a) ?? 0) ||
      a.localeCompare(b),
  )

  const picked: string[] = []
  const usedWeeks = new Set<string>()
  const adjacent = (a: string, b: string) =>
    Math.abs(differenceInCalendarDays(new Date(a + 'T12:00:00'), new Date(b + 'T12:00:00'))) <= 1
  for (const date of ranked) {
    if (picked.length >= opts.count) break
    if (usedWeeks.has(weekKey(date))) continue
    if (picked.some((p) => adjacent(p, date))) continue
    picked.push(date)
    usedWeeks.add(weekKey(date))
  }
  return picked
}
