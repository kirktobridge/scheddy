import { format } from 'date-fns'
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
