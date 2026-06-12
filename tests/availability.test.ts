import { describe, expect, it } from 'vitest'
import {
  eventsToBusy,
  findFreeSlots,
  mergeIntervals,
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
