import { describe, expect, it } from 'vitest'
import {
  blockedDates,
  dayIsolation,
  eventsToBusy,
  findFreeSlots,
  mergeIntervals,
  rankFreeDays,
  type BusyInterval,
  type Slot,
  type Windows,
} from '../src/lib/availability'
import type { GEvent } from '../src/api/calendar'

const windows: Windows = {
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '22:00' },
}

// Tests run with TZ=America/New_York (set in vite.config.ts).
const d = (iso: string) => new Date(iso)

function timed(startIso: string, endIso: string, extra: Partial<GEvent> = {}): GEvent {
  return {
    id: Math.random().toString(36).slice(2),
    summary: 'event',
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    ...extra,
  }
}

describe('mergeIntervals', () => {
  it('merges overlapping and touching intervals, keeps gaps', () => {
    const merged = mergeIntervals([
      { start: d('2026-06-15T10:00'), end: d('2026-06-15T11:00') },
      { start: d('2026-06-15T10:30'), end: d('2026-06-15T12:00') },
      { start: d('2026-06-15T12:00'), end: d('2026-06-15T13:00') },
      { start: d('2026-06-15T15:00'), end: d('2026-06-15T16:00') },
    ])
    expect(merged).toEqual([
      { start: d('2026-06-15T10:00'), end: d('2026-06-15T13:00') },
      { start: d('2026-06-15T15:00'), end: d('2026-06-15T16:00') },
    ])
  })
})

describe('eventsToBusy', () => {
  it('ignores all-day, transparent, and cancelled events', () => {
    const busy = eventsToBusy([
      { id: 'allday', summary: 'Electric bill due', start: { date: '2026-06-15' }, end: { date: '2026-06-16' } },
      timed('2026-06-15T18:00', '2026-06-15T19:00', { transparency: 'transparent' }),
      timed('2026-06-15T18:00', '2026-06-15T19:00', { status: 'cancelled' }),
      timed('2026-06-15T09:00', '2026-06-15T10:00'),
    ])
    expect(busy).toEqual([{ start: d('2026-06-15T09:00'), end: d('2026-06-15T10:00') }])
  })

  it('blocks all-day events when the global allDay flag is set', () => {
    const busy = eventsToBusy(
      [{ id: 'allday', summary: 'Vacation', start: { date: '2026-06-15' }, end: { date: '2026-06-16' } }],
      { allDay: true },
    )
    expect(busy).toEqual([{ start: d('2026-06-15T00:00'), end: d('2026-06-16T00:00') }])
  })

  it('blocks all-day events only for calendars in allDayCalendarIds', () => {
    const events: GEvent[] = [
      { id: 'a', summary: 'Joint trip', calendarId: 'joint', start: { date: '2026-06-15' }, end: { date: '2026-06-16' } },
      { id: 'b', summary: 'Bill due', calendarId: 'personal', start: { date: '2026-06-15' }, end: { date: '2026-06-16' } },
    ]
    const busy = eventsToBusy(events, { allDayCalendarIds: new Set(['joint']) })
    // Only the joint calendar's all-day event blocks; the personal one is ignored.
    expect(busy).toEqual([{ start: d('2026-06-15T00:00'), end: d('2026-06-16T00:00') }])
  })
})

describe('findFreeSlots', () => {
  const day = d('2026-06-15T00:00') // Monday
  const dayEnd = d('2026-06-15T23:59')

  it('returns all three windows for a fully free day', () => {
    const slots = findFreeSlots([], windows, day, dayEnd)
    expect(slots.map((s) => s.window)).toEqual(['morning', 'afternoon', 'evening'])
    expect(slots.every((s) => s.fullyFree)).toBe(true)
  })

  it('drops a window blocked by an event', () => {
    const busy = eventsToBusy([timed('2026-06-15T17:00', '2026-06-15T21:00')])
    const slots = findFreeSlots(busy, windows, day, dayEnd)
    expect(slots.map((s) => s.window)).toEqual(['morning', 'afternoon'])
  })

  it('keeps a window with a small intrusion and reports the free stretch', () => {
    // 17:00-18:00 busy leaves 18:00-22:00 = 80% of the 5h evening window
    const busy = eventsToBusy([timed('2026-06-15T17:00', '2026-06-15T18:00')])
    const slots = findFreeSlots(busy, windows, day, dayEnd, { windowFilter: ['evening'] })
    expect(slots).toHaveLength(1)
    expect(slots[0].freeFrom).toEqual(d('2026-06-15T18:00'))
    expect(slots[0].freeTo).toEqual(d('2026-06-15T22:00'))
    expect(slots[0].fullyFree).toBe(false)
    expect(slots[0].freeRatio).toBeCloseTo(0.8)
  })

  it('drops a window whose longest gap is under the threshold', () => {
    // 19:00-20:00 busy splits the evening into 2h + 2h gaps; 2/5 = 40% < 75%
    const busy = eventsToBusy([timed('2026-06-15T19:00', '2026-06-15T20:00')])
    const slots = findFreeSlots(busy, windows, day, dayEnd, { windowFilter: ['evening'] })
    expect(slots).toHaveLength(0)
  })

  it('respects a custom threshold', () => {
    const busy = eventsToBusy([timed('2026-06-15T19:00', '2026-06-15T20:00')])
    const slots = findFreeSlots(busy, windows, day, dayEnd, { windowFilter: ['evening'], threshold: 0.4 })
    expect(slots).toHaveLength(1)
  })

  it('clips slots to "now"', () => {
    const now = d('2026-06-15T20:00')
    const slots = findFreeSlots([], windows, day, dayEnd, { now })
    // Morning and afternoon are past; evening only has 2h left of 5h (40% < 75%)
    expect(slots).toHaveLength(0)
    const generous = findFreeSlots([], windows, day, dayEnd, { now, threshold: 0.3 })
    expect(generous).toHaveLength(1)
    expect(generous[0].freeFrom).toEqual(now)
    expect(generous[0].fullyFree).toBe(false)
  })

  it('scans multiple days', () => {
    const busy = eventsToBusy([timed('2026-06-16T08:00', '2026-06-16T22:00')])
    const slots = findFreeSlots(busy, windows, day, d('2026-06-17T23:59'))
    // Mon free (3) + Tue fully booked (0) + Wed free (3)
    expect(slots).toHaveLength(6)
    expect(new Set(slots.map((s) => s.date))).toEqual(new Set(['2026-06-15', '2026-06-17']))
  })

  it('handles events spanning a whole window boundary', () => {
    const busy = eventsToBusy([timed('2026-06-15T11:00', '2026-06-15T13:30')])
    const slots = findFreeSlots(busy, windows, day, dayEnd)
    // Morning loses 1h of 4h -> 75% exactly, afternoon loses 1.5h of 5h -> 70% < 75%
    expect(slots.map((s) => s.window)).toEqual(['morning', 'evening'])
  })
})

const busyInterval = (start: string, end: string): BusyInterval => ({ start: d(start), end: d(end) })

/** A day with a single free slot whose total free time is `hours`. */
function freeDay(date: string, hours: number): [string, Slot[]] {
  const freeFrom = d(date + 'T08:00')
  const freeTo = new Date(freeFrom.getTime() + hours * 60 * 60 * 1000)
  return [date, [{ date, window: 'morning', freeFrom, freeTo, fullyFree: true, freeRatio: 1 }]]
}

describe('blockedDates', () => {
  it('marks the day of a timed event', () => {
    expect([...blockedDates([busyInterval('2026-06-15T10:00', '2026-06-15T11:00')])]).toEqual(['2026-06-15'])
  })

  it('covers every day a multi-day interval spans (end exclusive)', () => {
    const set = blockedDates([busyInterval('2026-06-15T00:00', '2026-06-18T00:00')])
    expect([...set].sort()).toEqual(['2026-06-15', '2026-06-16', '2026-06-17'])
  })
})

describe('dayIsolation', () => {
  const blocked = new Set(['2026-06-15'])

  it('returns n when nothing is blocked within the window', () => {
    expect(dayIsolation('2026-06-01', blocked, 3)).toBe(3)
  })

  it('takes the smaller side when a blocking day is near', () => {
    expect(dayIsolation('2026-06-16', blocked, 3)).toBe(1)
    expect(dayIsolation('2026-06-14', blocked, 3)).toBe(1)
  })

  it('is 0 when disabled (n <= 0)', () => {
    expect(dayIsolation('2026-06-01', blocked, 0)).toBe(0)
  })
})

describe('rankFreeDays', () => {
  it('prefers a more isolated day over one with more free time but a busy neighbor', () => {
    const blocked = new Set(['2026-06-16']) // neighbor of the high-free day below
    const entries: [string, Slot[]][] = [
      freeDay('2026-06-15', 8), // most free time, but isolation 1
      freeDay('2026-06-20', 4), // less free time, isolation 3
    ]
    const top = rankFreeDays(entries, blocked, { count: 1, isolationWindow: 3, favorWeekends: true })
    expect(top.map(([d]) => d)).toEqual(['2026-06-20'])
  })

  it('breaks a free-time tie in favor of the weekend', () => {
    // 2026-06-20 is Saturday, 2026-06-18 is Thursday; same isolation + free time.
    const entries: [string, Slot[]][] = [freeDay('2026-06-18', 4), freeDay('2026-06-20', 4)]
    const top = rankFreeDays(entries, new Set(), { count: 1, isolationWindow: 3, favorWeekends: true })
    expect(top[0][0]).toBe('2026-06-20')
  })

  it('ignores weekends when favorWeekends is off (falls back to date)', () => {
    const entries: [string, Slot[]][] = [freeDay('2026-06-18', 4), freeDay('2026-06-20', 4)]
    const top = rankFreeDays(entries, new Set(), { count: 1, isolationWindow: 3, favorWeekends: false })
    expect(top[0][0]).toBe('2026-06-18')
  })

  it('respects count and returns results sorted by date', () => {
    const entries: [string, Slot[]][] = [freeDay('2026-06-20', 4), freeDay('2026-06-10', 4), freeDay('2026-06-15', 4)]
    const ranked = rankFreeDays(entries, new Set(), { count: 2, isolationWindow: 0, favorWeekends: false })
    expect(ranked).toHaveLength(2)
    const dates = ranked.map(([d]) => d)
    expect(dates).toEqual([...dates].sort())
  })
})
