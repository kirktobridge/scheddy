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
 * matches if the event contains ANY of the keywords. Cancelled events never
 * match. A rule's `calendarIds` scope (when non-empty) limits matching to those
 * calendars; empty/undefined means all calendars.
 */
export function matchRule(events: GEvent[], rule: MetricRule): GEvent[] {
  const kws = rule.keyword
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
  if (!kws.length) return []
  const scope = rule.calendarIds
  const scoped = scope && scope.length ? new Set(scope) : null
  return events.filter((ev) => {
    if (ev.status === 'cancelled') return false
    if (scoped && !(ev.calendarId && scoped.has(ev.calendarId))) return false
    const hay = (
      (ev.summary ?? '') + (rule.matchDescription ? '\n' + (ev.description ?? '') : '')
    ).toLowerCase()
    return kws.some((kw) => hay.includes(kw))
  })
}

const eventKey = (ev: GEvent): string => ev.iCalUID ?? `${ev.calendarId}/${ev.id}`

const isAllDay = (ev: GEvent): boolean => !ev.start?.dateTime && !!ev.start?.date

/**
 * Applies the per-rule blocking overrides to events before they become busy
 * intervals:
 *  - a `blocking` rule clears the "transparent" (Free) flag on matched timed
 *    events so they count as busy;
 *  - a rule's `allDay` override flips matched all-day events on ('block', given
 *    concrete times) or off ('free', marked transparent), overriding the global
 *    `blockAllDayEvents` setting. 'block' wins if both apply to one event.
 * Other events pass through untouched; returns the same array when nothing changes.
 */
export function applyRuleOverrides(events: GEvent[], rules: MetricRule[]): GEvent[] {
  const relevant = rules.filter((r) => r.blocking || r.allDay)
  if (!relevant.length) return events
  const blockTimed = new Set<string>()
  const allDayBlock = new Set<string>()
  const allDayFree = new Set<string>()
  for (const rule of relevant) {
    for (const ev of matchRule(events, rule)) {
      const k = eventKey(ev)
      if (rule.blocking) blockTimed.add(k)
      if (rule.allDay === 'block') allDayBlock.add(k)
      else if (rule.allDay === 'free') allDayFree.add(k)
    }
  }
  if (!blockTimed.size && !allDayBlock.size && !allDayFree.size) return events
  return events.map((ev) => {
    const k = eventKey(ev)
    if (isAllDay(ev)) {
      if (allDayBlock.has(k)) {
        return {
          ...ev,
          transparency: undefined,
          start: { dateTime: ev.start!.date + 'T00:00:00' },
          end: { dateTime: (ev.end?.date ?? ev.start!.date) + 'T00:00:00' },
        }
      }
      if (allDayFree.has(k)) return { ...ev, transparency: 'transparent' }
      return ev
    }
    if (ev.transparency === 'transparent' && blockTimed.has(k)) return { ...ev, transparency: undefined }
    return ev
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
