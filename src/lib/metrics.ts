import { isWeekend } from 'date-fns'
import type { GEvent } from '../api/calendar'
import {
  findFreeSlots,
  WINDOW_KEYS,
  type BusyInterval,
  type FindOpts,
  type Windows,
} from './availability'
import type { MetricRule } from '../store/settings'

/**
 * Events matching a keyword rule (case-insensitive substring on the title,
 * optionally also the description). Cancelled events never match.
 */
export function matchRule(events: GEvent[], rule: MetricRule): GEvent[] {
  const kw = rule.keyword.trim().toLowerCase()
  if (!kw) return []
  return events.filter((ev) => {
    if (ev.status === 'cancelled') return false
    const hay = (ev.summary ?? '') + (rule.matchDescription ? '\n' + (ev.description ?? '') : '')
    return hay.toLowerCase().includes(kw)
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

export function unbookedEvenings(
  busy: BusyInterval[],
  windows: Windows,
  rangeStart: Date,
  rangeEnd: Date,
  opts: Omit<FindOpts, 'windowFilter'> = {},
): number {
  return findFreeSlots(busy, windows, rangeStart, rangeEnd, { ...opts, windowFilter: ['evening'] }).length
}

/** Weekend days in range where every window (morning/afternoon/evening) is free. */
export function unbookedWeekendDays(
  busy: BusyInterval[],
  windows: Windows,
  rangeStart: Date,
  rangeEnd: Date,
  opts: Omit<FindOpts, 'windowFilter'> = {},
): number {
  const slots = findFreeSlots(busy, windows, rangeStart, rangeEnd, opts)
  const byDate = new Map<string, number>()
  for (const slot of slots) {
    byDate.set(slot.date, (byDate.get(slot.date) ?? 0) + 1)
  }
  let count = 0
  for (const [date, n] of byDate) {
    if (n === WINDOW_KEYS.length && isWeekend(new Date(date + 'T12:00:00'))) count++
  }
  return count
}
