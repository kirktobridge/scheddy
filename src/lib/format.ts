import { eachDayOfInterval, format, startOfDay } from 'date-fns'
import type { GEvent } from '../api/calendar'

export function fmtTime(d: Date): string {
  return format(d, 'h:mmaaa').replace(':00', '')
}

export function fmtDay(dateStr: string): string {
  return format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d')
}

export function eventStart(ev: GEvent): Date {
  return new Date(ev.start?.dateTime ?? (ev.start?.date ? ev.start.date + 'T00:00:00' : 0))
}

/**
 * Every calendar day (yyyy-MM-dd) an event covers — not just its start. A 5-day
 * trip returns 5 dates. Google all-day end dates are exclusive; timed events
 * ending exactly at midnight don't bleed into the next day.
 */
export function eventDates(ev: GEvent): string[] {
  let start: Date
  let lastDay: Date
  if (ev.start?.dateTime) {
    start = new Date(ev.start.dateTime)
    const end = ev.end?.dateTime ? new Date(ev.end.dateTime) : start
    lastDay = new Date(Math.max(start.getTime(), end.getTime() - 1))
  } else if (ev.start?.date) {
    start = new Date(ev.start.date + 'T12:00:00')
    const endExclusive = ev.end?.date
      ? new Date(ev.end.date + 'T12:00:00')
      : new Date(start.getTime() + 24 * 3600 * 1000)
    lastDay = new Date(Math.max(start.getTime(), endExclusive.getTime() - 24 * 3600 * 1000))
  } else {
    return []
  }
  return eachDayOfInterval({ start: startOfDay(start), end: startOfDay(lastDay) }).map((d) =>
    format(d, 'yyyy-MM-dd'),
  )
}

/**
 * Active events occurring on `date` (yyyy-MM-dd), sorted all-day first then by
 * start time. Cancelled events are dropped; transparent/"free" events are kept
 * (this is a literal agenda, not a busy calc).
 */
export function eventsForDay(events: GEvent[], date: string): GEvent[] {
  return events
    .filter((ev) => ev.status !== 'cancelled' && eventDates(ev).includes(date))
    .sort((a, b) => {
      const aAllDay = !a.start?.dateTime
      const bAllDay = !b.start?.dateTime
      if (aAllDay !== bAllDay) return aAllDay ? -1 : 1
      return eventStart(a).getTime() - eventStart(b).getTime()
    })
}

export function fmtEventWhen(ev: GEvent): string {
  if (ev.start?.dateTime && ev.end?.dateTime) {
    const start = new Date(ev.start.dateTime)
    const end = new Date(ev.end.dateTime)
    return `${format(start, 'EEE, MMM d')} · ${fmtTime(start)}–${fmtTime(end)}`
  }
  if (ev.start?.date) {
    const start = new Date(ev.start.date + 'T12:00:00')
    // Google all-day end dates are exclusive
    const endExclusive = ev.end?.date ? new Date(ev.end.date + 'T12:00:00') : start
    const lastDay = new Date(endExclusive.getTime() - 24 * 3600 * 1000)
    if (lastDay.getTime() > start.getTime()) {
      return `${format(start, 'MMM d')}–${format(lastDay, 'MMM d')} · all day`
    }
    return `${format(start, 'EEE, MMM d')} · all day`
  }
  return ''
}
