import { describe, expect, it } from 'vitest'
import { addDays, startOfMonth } from 'date-fns'
import { mockCreateEvent, mockEventsMulti } from '../src/api/mock'
import { matchRule } from '../src/lib/metrics'
import { eventDates } from '../src/lib/format'

const ids = ['mock-personal', 'mock-work']
const tripRule = { id: 'trips', name: 'Trips', keyword: 'trip', icon: '✈️', matchDescription: false }

describe('mock data — trips scenario', () => {
  const now = new Date()
  // Span the whole current month (matching the metric scan) so the early-month
  // trip is captured no matter what day of the month "now" falls on.
  const events = mockEventsMulti(ids, startOfMonth(now), addDays(now, 60))

  it('seeds two trips in the window', () => {
    const trips = matchRule(events, tripRule)
    expect(trips).toHaveLength(2)
  })

  it('multi-day trips expand to every day they span (the highlight bug)', () => {
    const trips = matchRule(events, tripRule)
    const days = trips.flatMap((ev) => eventDates(ev))
    // Two trips of 4 and 5 days → far more than 2 highlighted days.
    expect(days.length).toBeGreaterThan(2)
    expect(new Set(days).size).toBe(days.length) // no dupes within
  })
})

describe('mock createEvent', () => {
  it('appends a created event so it shows up on the next fetch', () => {
    const now = new Date()
    const start = addDays(now, 2)
    const end = addDays(now, 2)
    const created = mockCreateEvent('mock-us', {
      summary: 'Booked date',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    })
    expect(created.calendarId).toBe('mock-us')
    const fetched = mockEventsMulti(['mock-us'], addDays(now, -1), addDays(now, 5))
    expect(fetched.some((e) => e.summary === 'Booked date')).toBe(true)
  })
})
