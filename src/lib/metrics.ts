import { isWeekend } from 'date-fns'
import type { GEvent } from '../api/calendar'
import {
  findFreeSlots,
  type BusyInterval,
  type FindOpts,
  type Windows,
} from './availability'
import type { MetricRule } from '../store/settings'

/**
 * Events matching a keyword rule (case-insensitive substring on the title,
 * optionally also the description). The keyword field is comma-separated and
 * matches if the event contains ANY of the keywords. Cancelled events never match.
 */
export function matchRule(events: GEvent[], rule: MetricRule): GEvent[] {
  const kws = rule.keyword
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
  if (!kws.length) return []
  return events.filter((ev) => {
    if (ev.status === 'cancelled') return false
    const hay = (
      (ev.summary ?? '') + (rule.matchDescription ? '\n' + (ev.description ?? '') : '')
    ).toLowerCase()
    return kws.some((kw) => hay.includes(kw))
  })
}

/**
 * The same shared event can come back from several calendars; collapse
 * duplicates by iCalUID so metrics don't double-count.
 */
export function dedupeEvents(events: GEvent[]): GEvent[] {
  const seen = new Set<string>()
  return events.filter((ev) => {
    const key = ev.iCalUID ?? `${ev.calendarId}/${ev.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Dates (yyyy-MM-dd) in range with a free evening slot. */
export function unbookedEveningDates(
  busy: BusyInterval[],
  windows: Windows,
  rangeStart: Date,
  rangeEnd: Date,
  opts: Omit<FindOpts, 'windowFilter'> = {},
): string[] {
  return findFreeSlots(busy, windows, rangeStart, rangeEnd, { ...opts, windowFilter: ['evening'] }).map((s) => s.date)
}

export function unbookedEvenings(
  busy: BusyInterval[],
  windows: Windows,
  rangeStart: Date,
  rangeEnd: Date,
  opts: Omit<FindOpts, 'windowFilter'> = {},
): number {
  return unbookedEveningDates(busy, windows, rangeStart, rangeEnd, opts).length
}

/** Weekend dates (yyyy-MM-dd) where every window (morning/afternoon/evening) is free. */
export function unbookedWeekendDayDates(
  busy: BusyInterval[],
  windows: Windows,
  rangeStart: Date,
  rangeEnd: Date,
  opts: Omit<FindOpts, 'windowFilter'> = {},
): string[] {
  const slots = findFreeSlots(busy, windows, rangeStart, rangeEnd, opts)
  const byDate = new Map<string, number>()
  for (const slot of slots) {
    byDate.set(slot.date, (byDate.get(slot.date) ?? 0) + 1)
  }
  const out: string[] = []
  for (const [date, n] of byDate) {
    if (n === Object.keys(windows).length && isWeekend(new Date(date + 'T12:00:00'))) out.push(date)
  }
  return out
}

/** Weekend days in range where every window (morning/afternoon/evening) is free. */
export function unbookedWeekendDays(
  busy: BusyInterval[],
  windows: Windows,
  rangeStart: Date,
  rangeEnd: Date,
  opts: Omit<FindOpts, 'windowFilter'> = {},
): number {
  return unbookedWeekendDayDates(busy, windows, rangeStart, rangeEnd, opts).length
}
