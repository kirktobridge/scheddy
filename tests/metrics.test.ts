import { describe, expect, it } from 'vitest'
import { dedupeEvents, matchRule, unbookedEvenings, unbookedWeekendDays } from '../src/lib/metrics'
import { eventsToBusy, type Windows } from '../src/lib/availability'
import type { GEvent } from '../src/api/calendar'
import type { MetricRule } from '../src/store/settings'

const windows: Windows = {
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '22:00' },
}

const rule = (overrides: Partial<MetricRule> = {}): MetricRule => ({
  id: 'r1',
  name: 'Date nights',
  keyword: 'date',
  icon: '❤️',
  matchDescription: false,
  ...overrides,
})

const ev = (summary: string, extra: Partial<GEvent> = {}): GEvent => ({
  id: Math.random().toString(36).slice(2),
  summary,
  start: { dateTime: '2026-06-15T18:00' },
  end: { dateTime: '2026-06-15T20:00' },
  ...extra,
})

describe('matchRule', () => {
  it('matches case-insensitively on the title', () => {
    const events = [ev('Date: dinner at Luigi\'s'), ev('Dentist'), ev('Double DATE with the Smiths')]
    expect(matchRule(events, rule()).map((e) => e.summary)).toEqual([
      "Date: dinner at Luigi's",
      'Double DATE with the Smiths',
    ])
  })

  it('searches the description only when enabled', () => {
    const events = [ev('Dinner', { description: 'date night!' })]
    expect(matchRule(events, rule())).toHaveLength(0)
    expect(matchRule(events, rule({ matchDescription: true }))).toHaveLength(1)
  })

  it('matches any of several comma-separated keywords', () => {
    const events = [ev('Date night'), ev('Dinner out'), ev('Gym')]
    expect(matchRule(events, rule({ keyword: 'date, dinner' })).map((e) => e.summary)).toEqual([
      'Date night',
      'Dinner out',
    ])
  })

  it('skips cancelled events and empty keywords', () => {
    expect(matchRule([ev('Date night', { status: 'cancelled' })], rule())).toHaveLength(0)
    expect(matchRule([ev('Date night')], rule({ keyword: '  ' }))).toHaveLength(0)
  })
})

describe('dedupeEvents', () => {
  it('collapses the same event seen from two calendars', () => {
    const events = [
      ev('Date night', { iCalUID: 'abc@google.com', calendarId: 'mine' }),
      ev('Date night', { iCalUID: 'abc@google.com', calendarId: 'wife' }),
      ev('Dentist', { calendarId: 'mine' }),
    ]
    expect(dedupeEvents(events)).toHaveLength(2)
  })
})

describe('computed metrics', () => {
  // 2026-06-15 (Mon) .. 2026-06-21 (Sun)
  const start = new Date('2026-06-15T00:00')
  const end = new Date('2026-06-21T23:59')

  it('counts unbooked evenings', () => {
    const busy = eventsToBusy([
      ev('Dinner party', { start: { dateTime: '2026-06-16T17:00' }, end: { dateTime: '2026-06-16T21:00' } }),
      ev('Concert', { start: { dateTime: '2026-06-19T18:00' }, end: { dateTime: '2026-06-19T23:00' } }),
    ])
    // 7 evenings minus Tue and Fri
    expect(unbookedEvenings(busy, windows, start, end)).toBe(5)
  })

  it('counts weekend days where all windows are free', () => {
    expect(unbookedWeekendDays([], windows, start, end)).toBe(2)
    const busy = eventsToBusy([
      ev('Brunch', { start: { dateTime: '2026-06-20T09:00' }, end: { dateTime: '2026-06-20T11:30' } }),
    ])
    // Saturday morning mostly booked -> only Sunday counts
    expect(unbookedWeekendDays(busy, windows, start, end)).toBe(1)
  })
})
