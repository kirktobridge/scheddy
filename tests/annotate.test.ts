import { describe, expect, it } from 'vitest'
import {
  adjustForWork,
  holidayNote,
  nextDayWarning,
  relativeDayLabel,
  slotBookings,
  summarizeDay,
} from '../src/lib/annotate'
import { dayTimeline, findFreeSlots, eventsToBusy, windowKeys, type Slot, type Windows } from '../src/lib/availability'
import type { GEvent } from '../src/api/calendar'

const windows: Windows = {
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '22:00' },
}

const timed = (startIso: string, endIso: string, summary = 'event', extra: Partial<GEvent> = {}): GEvent => ({
  id: Math.random().toString(36).slice(2),
  summary,
  start: { dateTime: startIso },
  end: { dateTime: endIso },
  ...extra,
})

const allDay = (startDate: string, endDate: string, summary: string): GEvent => ({
  id: Math.random().toString(36).slice(2),
  summary,
  start: { date: startDate },
  end: { date: endDate },
})

describe('dayTimeline', () => {
  // Default windows span 08:00–22:00 = 14h.
  it('fully-free day is one free segment covering the span', () => {
    const { segments } = dayTimeline([], windows, '2026-06-15')
    expect(segments).toEqual([{ kind: 'free', startFrac: 0, endFrac: 1 }])
  })

  it('splits free/busy/free around a mid-day busy block', () => {
    // Busy 12:00–13:00 → 4h in (of 14h) to 5h in.
    const busy = eventsToBusy([timed('2026-06-15T12:00', '2026-06-15T13:00')])
    const { segments } = dayTimeline(busy, windows, '2026-06-15')
    expect(segments.map((s) => s.kind)).toEqual(['free', 'busy', 'free'])
    expect(segments[1].startFrac).toBeCloseTo(4 / 14)
    expect(segments[1].endFrac).toBeCloseTo(5 / 14)
  })

  it('sets nowFrac when now falls inside the span', () => {
    // 15:00 is 7h into a 14h span.
    const { nowFrac } = dayTimeline([], windows, '2026-06-15', new Date('2026-06-15T15:00'))
    expect(nowFrac).toBeCloseTo(0.5)
  })

  it('dayStart extends the span earlier and clips availability before it', () => {
    // dayStart 06:00 is before the 08:00 morning window → span grows to 16h.
    const early = dayTimeline([], windows, '2026-06-15', undefined, '06:00')
    expect(early.ticks[0]).toEqual({ frac: 0, label: '6am' })
    expect(early.segments).toEqual([{ kind: 'free', startFrac: 0, endFrac: 1 }])
    // dayStart later than the first window clips the front: span starts at 10am.
    const late = dayTimeline([], windows, '2026-06-15', undefined, '10:00')
    expect(late.ticks[0]).toEqual({ frac: 0, label: '10am' })
  })

  it('spans earliest window start to latest window end for custom windows', () => {
    const custom: Windows = { dawn: { start: '06:00', end: '09:00' }, night: { start: '20:00', end: '23:00' } }
    const { ticks } = dayTimeline([], custom, '2026-06-15')
    expect(ticks[0]).toEqual({ frac: 0, label: '6am' })
    expect(ticks[ticks.length - 1]).toEqual({ frac: 1, label: '11pm' })
  })
})

describe('relativeDayLabel', () => {
  // 2026-06-12 is a Friday
  const today = new Date('2026-06-12T09:00')
  const cases: [string, string][] = [
    ['2026-06-12', 'today'],
    ['2026-06-13', 'tomorrow'],
    ['2026-06-14', 'day after tomorrow'],
    ['2026-06-18', 'next Thursday'], // following week (weeks start Sunday)
    ['2026-06-20', 'next Saturday'],
    ['2026-06-25', 'in 13 days'],
  ]
  it.each(cases)('%s -> %s', (date, expected) => {
    expect(relativeDayLabel(new Date(date + 'T12:00:00'), today)).toBe(expected)
  })

  it('labels later days in the same week as "this X"', () => {
    // Monday looking at Thursday of the same week
    expect(relativeDayLabel(new Date('2026-06-18T12:00:00'), new Date('2026-06-15T09:00'))).toBe('this Thursday')
  })
})

describe('slotBookings', () => {
  it('lists the events intruding into a partly booked slot', () => {
    const events = [timed('2026-06-15T17:00', '2026-06-15T18:00', 'Standup')]
    const [slot] = findFreeSlots(eventsToBusy(events), windows, new Date('2026-06-15T00:00'), new Date('2026-06-15T23:59'), {
      windowFilter: ['evening'],
    })
    expect(slotBookings(events, slot, windows)).toEqual(['Standup (5pm–6pm)'])
  })

  it('returns nothing for fully free slots', () => {
    const [slot] = findFreeSlots([], windows, new Date('2026-06-15T00:00'), new Date('2026-06-15T23:59'), {
      windowFilter: ['evening'],
    })
    expect(slotBookings([], slot, windows)).toEqual([])
  })
})

describe('nextDayWarning', () => {
  it('warns about an all-day event the next day', () => {
    const events = [allDay('2026-06-16', '2026-06-18', 'Beach trip')]
    expect(nextDayWarning(events, '2026-06-15')).toBe('next day: Beach trip (all day)')
    expect(nextDayWarning(events, '2026-06-16')).toBe('next day: Beach trip (all day)') // exclusive end: covers the 17th
    expect(nextDayWarning(events, '2026-06-17')).toBeUndefined() // the 18th is past the trip
  })

  it('warns about an early start the next morning', () => {
    const events = [timed('2026-06-16T09:00', '2026-06-16T10:00', 'Dentist')]
    expect(nextDayWarning(events, '2026-06-15')).toBe('early start next day: Dentist at 9am')
  })

  it('ignores next-day events at or after noon', () => {
    const events = [timed('2026-06-16T12:00', '2026-06-16T13:00', 'Lunch')]
    expect(nextDayWarning(events, '2026-06-15')).toBeUndefined()
  })
})

describe('summarizeDay', () => {
  const day = new Date('2026-06-15T00:00')
  const dayEnd = new Date('2026-06-15T23:59')

  const keys = windowKeys(windows)

  it('says "free all day" when all three windows are fully free', () => {
    const slots = findFreeSlots([], windows, day, dayEnd)
    expect(summarizeDay(slots, keys)).toBe('free all day')
  })

  it('lists the open windows otherwise', () => {
    const busy = eventsToBusy([timed('2026-06-15T12:00', '2026-06-15T17:00', 'Work block')])
    const slots = findFreeSlots(busy, windows, day, dayEnd)
    expect(summarizeDay(slots, keys)).toBe('morning + evening free')
  })

  it('does not claim "free all day" when a window is only partly free', () => {
    const busy = eventsToBusy([timed('2026-06-15T17:00', '2026-06-15T18:00', 'Standup')])
    const slots = findFreeSlots(busy, windows, day, dayEnd)
    expect(summarizeDay(slots, keys)).toBe('morning + afternoon + evening free')
  })

  it('handles a single open window', () => {
    const busy = eventsToBusy([timed('2026-06-15T08:00', '2026-06-15T17:00', 'All-dayer')])
    const slots = findFreeSlots(busy, windows, day, dayEnd)
    expect(summarizeDay(slots, keys)).toBe('evening free')
  })
})

describe('adjustForWork', () => {
  const eveningSlot = (): Slot => {
    const [slot] = findFreeSlots([], windows, new Date('2026-06-15T00:00'), new Date('2026-06-15T23:59'), {
      windowFilter: ['evening'],
    })
    return slot // fully free 5–10pm
  }

  it('relabels a work-trimmed evening as free-after-work', () => {
    const workBusy = eventsToBusy([timed('2026-06-15T17:00', '2026-06-15T18:30', 'Late shift')])
    const adjusted = adjustForWork(eveningSlot(), workBusy)
    expect(adjusted).not.toBeNull()
    expect(adjusted!.freeAfterWork).toBe(true)
    expect(adjusted!.fullyFree).toBe(false)
    expect(adjusted!.freeFrom).toEqual(new Date('2026-06-15T18:30'))
    expect(adjusted!.freeTo).toEqual(new Date('2026-06-15T22:00'))
  })

  it('leaves a slot untouched when work does not overlap it', () => {
    const workBusy = eventsToBusy([timed('2026-06-15T09:00', '2026-06-15T17:00', '9-to-5')])
    const adjusted = adjustForWork(eveningSlot(), workBusy)
    expect(adjusted!.freeAfterWork).toBe(false)
    expect(adjusted!.fullyFree).toBe(true)
    expect(adjusted!.freeFrom).toEqual(new Date('2026-06-15T17:00'))
  })

  it('drops a slot fully consumed by work', () => {
    const workBusy = eventsToBusy([timed('2026-06-15T16:00', '2026-06-15T23:00', 'Overnight')])
    expect(adjustForWork(eveningSlot(), workBusy)).toBeNull()
  })
})

describe('holidayNote', () => {
  const holidays = [allDay('2026-07-04', '2026-07-05', 'Independence Day')]
  it('flags the holiday itself and nearby days', () => {
    expect(holidayNote(holidays, '2026-07-04')).toBe('Independence Day')
    expect(holidayNote(holidays, '2026-07-03')).toBe('day before Independence Day')
    expect(holidayNote(holidays, '2026-07-05')).toBe('day after Independence Day')
    expect(holidayNote(holidays, '2026-07-02')).toBe('2 days before Independence Day')
    expect(holidayNote(holidays, '2026-06-30')).toBeUndefined()
  })
})
