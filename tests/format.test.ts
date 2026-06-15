import { describe, expect, it } from 'vitest'
import { eventDates } from '../src/lib/format'
import type { GEvent } from '../src/api/calendar'

const ev = (extra: Partial<GEvent>): GEvent => ({ id: 'x', summary: 'e', ...extra })

describe('eventDates', () => {
  it('returns the single day for a timed event', () => {
    expect(eventDates(ev({ start: { dateTime: '2026-06-15T18:00' }, end: { dateTime: '2026-06-15T20:00' } }))).toEqual([
      '2026-06-15',
    ])
  })

  it('spans every day of a multi-day all-day trip (end is exclusive)', () => {
    // A 3-night trip: Google stores end.date as the day after the last night.
    expect(eventDates(ev({ start: { date: '2026-06-12' }, end: { date: '2026-06-15' } }))).toEqual([
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
    ])
  })

  it('returns one day for a single all-day event', () => {
    expect(eventDates(ev({ start: { date: '2026-06-20' }, end: { date: '2026-06-21' } }))).toEqual(['2026-06-20'])
  })

  it('does not bleed into the next day when a timed event ends at midnight', () => {
    expect(eventDates(ev({ start: { dateTime: '2026-06-15T22:00' }, end: { dateTime: '2026-06-16T00:00' } }))).toEqual([
      '2026-06-15',
    ])
  })

  it('spans days for a multi-day timed event', () => {
    expect(eventDates(ev({ start: { dateTime: '2026-06-15T18:00' }, end: { dateTime: '2026-06-17T09:00' } }))).toEqual([
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
    ])
  })
})
