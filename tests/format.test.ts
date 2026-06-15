import { describe, expect, it } from 'vitest'
import { eventDates, eventsForDay } from '../src/lib/format'
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

describe('eventsForDay', () => {
  const timed = ev({ id: 'a', summary: 'Standup', start: { dateTime: '2026-06-15T09:00' }, end: { dateTime: '2026-06-15T10:00' } })
  const later = ev({ id: 'b', summary: 'Lunch', start: { dateTime: '2026-06-15T12:00' }, end: { dateTime: '2026-06-15T13:00' } })
  const allDay = ev({ id: 'c', summary: 'Anniversary', start: { date: '2026-06-15' }, end: { date: '2026-06-16' } })
  const other = ev({ id: 'd', summary: 'Off-day', start: { dateTime: '2026-06-16T09:00' }, end: { dateTime: '2026-06-16T10:00' } })
  const cancelled = ev({ id: 'e', summary: 'Dropped', status: 'cancelled', start: { dateTime: '2026-06-15T08:00' }, end: { dateTime: '2026-06-15T08:30' } })

  it('keeps only events on the date, sorted all-day first then by start', () => {
    const out = eventsForDay([later, allDay, timed, other], '2026-06-15')
    expect(out.map((e) => e.id)).toEqual(['c', 'a', 'b'])
  })

  it('drops cancelled events', () => {
    expect(eventsForDay([cancelled, timed], '2026-06-15').map((e) => e.id)).toEqual(['a'])
  })
})
