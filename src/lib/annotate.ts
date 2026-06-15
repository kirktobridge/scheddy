import { addDays, differenceInCalendarDays, format, isSameWeek } from 'date-fns'
import type { GEvent } from '../api/calendar'
import { atTime, freeGaps, type BusyInterval, type Slot, type WindowKey, type Windows } from './availability'
import { fmtTime } from './format'

/**
 * Short summary of a day's free windows: "free all day" when every configured
 * window is fully open, otherwise the open windows joined in `allKeys` order,
 * e.g. "morning + evening free". `allKeys` is the full set of window names.
 */
export function summarizeDay(slots: Slot[], allKeys: WindowKey[]): string {
  const present = allKeys.filter((k) => slots.some((s) => s.window === k))
  if (present.length === 0) return ''
  if (present.length === allKeys.length && slots.every((s) => s.fullyFree)) return 'free all day'
  return `${present.join(' + ')} free`
}

/**
 * Re-evaluates a slot against work busy intervals: subtracts work time from
 * the slot's free stretch and returns the longest remaining gap. If a work
 * event trims the front, `freeAfterWork` is set (and the slot is no longer
 * "partly booked" — it's "free after work"). Returns null if work fills the
 * whole stretch. `workBusy` must be merged (use eventsToBusy).
 */
export function adjustForWork(slot: Slot, workBusy: BusyInterval[]): Slot | null {
  const gaps = freeGaps(workBusy, slot.freeFrom, slot.freeTo)
  if (gaps.length === 0) return null
  const longest = gaps.reduce((a, b) =>
    b.end.getTime() - b.start.getTime() > a.end.getTime() - a.start.getTime() ? b : a,
  )
  const freeAfterWork = longest.start.getTime() > slot.freeFrom.getTime()
  return {
    ...slot,
    freeFrom: longest.start,
    freeTo: longest.end,
    freeAfterWork,
    fullyFree: slot.fullyFree && !freeAfterWork,
  }
}

/** "tomorrow", "day after tomorrow", "this Thursday", "next Thursday", "in 12 days" */
export function relativeDayLabel(date: Date, today: Date): string {
  const diff = differenceInCalendarDays(date, today)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === 2) return 'day after tomorrow'
  const dayName = format(date, 'EEEE')
  if (isSameWeek(date, today)) return `this ${dayName}`
  if (isSameWeek(date, addDays(today, 7))) return `next ${dayName}`
  return `in ${diff} days`
}

function active(ev: GEvent): boolean {
  return ev.status !== 'cancelled'
}

/** Google all-day end dates are exclusive. */
function coversAllDay(ev: GEvent, dateStr: string): boolean {
  if (!ev.start?.date) return false
  if (ev.end?.date) return ev.start.date <= dateStr && dateStr < ev.end.date
  return ev.start.date === dateStr
}

/** Titles + times of the events intruding into a partly-booked slot's window. */
export function slotBookings(events: GEvent[], slot: Slot, windows: Windows): string[] {
  if (slot.fullyFree) return []
  const day = new Date(slot.date + 'T00:00:00')
  const ws = atTime(day, windows[slot.window].start)
  const we = atTime(day, windows[slot.window].end)
  return events
    .filter((ev) => active(ev) && ev.transparency !== 'transparent' && ev.start?.dateTime && ev.end?.dateTime)
    .filter((ev) => new Date(ev.start!.dateTime!) < we && new Date(ev.end!.dateTime!) > ws)
    .sort((a, b) => new Date(a.start!.dateTime!).getTime() - new Date(b.start!.dateTime!).getTime())
    .map(
      (ev) =>
        `${ev.summary ?? '(no title)'} (${fmtTime(new Date(ev.start!.dateTime!))}–${fmtTime(new Date(ev.end!.dateTime!))})`,
    )
}

/**
 * For a free evening: warn if the following day is consumed by an all-day
 * event (on a blocking calendar) or starts with an event before noon.
 */
export function nextDayWarning(events: GEvent[], dateStr: string): string | undefined {
  const next = format(addDays(new Date(dateStr + 'T12:00:00'), 1), 'yyyy-MM-dd')
  const allDay = events.find((ev) => active(ev) && coversAllDay(ev, next))
  if (allDay) return `next day: ${allDay.summary ?? 'busy'} (all day)`
  const dayStart = new Date(next + 'T00:00:00')
  const noon = new Date(next + 'T12:00:00')
  const early = events
    .filter((ev) => active(ev) && ev.transparency !== 'transparent' && ev.start?.dateTime)
    .map((ev) => ({ ev, start: new Date(ev.start!.dateTime!) }))
    .filter(({ start }) => start >= dayStart && start < noon)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0]
  if (early) return `early start next day: ${early.ev.summary ?? '(no title)'} at ${fmtTime(early.start)}`
  return undefined
}

/** Nearest holiday within ±maxDays: "Memorial Day", "2 days before July 4th", "day after Labor Day". */
export function holidayNote(holidays: GEvent[], dateStr: string, maxDays = 3): string | undefined {
  let best: { diff: number; name: string } | null = null
  const day = new Date(dateStr + 'T12:00:00')
  for (const ev of holidays) {
    if (!active(ev) || !ev.start?.date) continue
    const diff = differenceInCalendarDays(new Date(ev.start.date + 'T12:00:00'), day)
    if (Math.abs(diff) > maxDays) continue
    if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { diff, name: ev.summary ?? 'holiday' }
  }
  if (!best) return undefined
  const { diff, name } = best
  if (diff === 0) return name
  if (diff === 1) return `day before ${name}`
  if (diff === -1) return `day after ${name}`
  return diff > 0 ? `${diff} days before ${name}` : `${-diff} days after ${name}`
}
