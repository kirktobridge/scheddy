import { describe, expect, it } from 'vitest'
import {
  datesInRange,
  lastDateEvent,
  longestGapMs,
  nextDateEvent,
  notWorkingDates,
  overlapByDate,
  overlapDates,
  overlapFreeGaps,
  overlapInWindowMs,
  overlapLongestMs,
  rankDateCandidates,
  weekKey,
  weeksWithDateEvent,
} from '../src/lib/relationship'
import { type BusyInterval, type Windows } from '../src/lib/availability'
import { matchRule } from '../src/lib/metrics'
import type { GEvent } from '../src/api/calendar'

const windows: Windows = {
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '22:00' },
}

// Tests run with TZ=America/New_York (set in vite.config.ts).
const d = (iso: string) => new Date(iso)
const busy = (start: string, end: string): BusyInterval => ({ start: d(start), end: d(end) })
const HOUR = 60 * 60 * 1000

describe('datesInRange', () => {
  it('lists every day inclusive', () => {
    expect(datesInRange(d('2026-06-15T00:00'), d('2026-06-17T23:59'))).toEqual([
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
    ])
  })
})

describe('overlapFreeGaps', () => {
  it('returns time free for both = free gaps of the union of busy', () => {
    const mine = [busy('2026-06-15T10:00', '2026-06-15T12:00')]
    const partner = [busy('2026-06-15T13:00', '2026-06-15T14:00')]
    const gaps = overlapFreeGaps(mine, partner, d('2026-06-15T08:00'), d('2026-06-15T22:00'))
    expect(gaps).toEqual([
      { start: d('2026-06-15T08:00'), end: d('2026-06-15T10:00') },
      { start: d('2026-06-15T12:00'), end: d('2026-06-15T13:00') },
      { start: d('2026-06-15T14:00'), end: d('2026-06-15T22:00') },
    ])
  })
})

describe('overlapLongestMs', () => {
  it('measures the longest mutual free stretch over the waking-day span', () => {
    const mine = [busy('2026-06-15T10:00', '2026-06-15T12:00')]
    const partner = [busy('2026-06-15T13:00', '2026-06-15T14:00')]
    // span 08:00-22:00; longest mutual gap is 14:00-22:00 = 8h
    expect(overlapLongestMs(mine, partner, windows, '2026-06-15')).toBe(8 * HOUR)
  })

  it('is 0 when one partner is busy the whole span', () => {
    const mine = [busy('2026-06-15T08:00', '2026-06-15T22:00')]
    expect(overlapLongestMs(mine, [], windows, '2026-06-15')).toBe(0)
  })
})

describe('overlapInWindowMs', () => {
  it('measures mutual free time inside one window only', () => {
    // Mine busy all morning + afternoon; partner free. Evening (17-22) fully mutual = 5h.
    const mine = [busy('2026-06-15T08:00', '2026-06-15T17:00')]
    expect(overlapInWindowMs(mine, [], windows, 'evening', '2026-06-15')).toBe(5 * HOUR)
    // A partner block trims the evening to 17-19 = 2h.
    const partner = [busy('2026-06-15T19:00', '2026-06-15T22:00')]
    expect(overlapInWindowMs(mine, partner, windows, 'evening', '2026-06-15')).toBe(2 * HOUR)
  })

  it('returns 0 for an unknown window', () => {
    expect(overlapInWindowMs([], [], windows, 'midnight', '2026-06-15')).toBe(0)
  })
})

describe('overlapDates / overlapByDate', () => {
  it('keeps only days meeting the minimum mutual free time', () => {
    const mine = [
      busy('2026-06-15T08:00', '2026-06-15T20:00'), // leaves 20-22 = 2h
      busy('2026-06-16T08:00', '2026-06-16T17:00'), // leaves 17-22 = 5h
    ]
    const map = overlapByDate(mine, [], windows, ['2026-06-15', '2026-06-16'])
    expect(map.get('2026-06-15')).toBe(2 * HOUR)
    expect(map.get('2026-06-16')).toBe(5 * HOUR)
    expect(overlapDates(map, 3 * HOUR)).toEqual(new Set(['2026-06-16']))
  })
})

describe('longestGapMs', () => {
  it('returns 0 for no gaps', () => {
    expect(longestGapMs([])).toBe(0)
  })
})

describe('notWorkingDates', () => {
  it('excludes days the partner has a work event', () => {
    const partnerWork = [busy('2026-06-16T09:00', '2026-06-16T17:00')]
    const result = notWorkingDates(partnerWork, ['2026-06-15', '2026-06-16', '2026-06-17'])
    expect(result).toEqual(new Set(['2026-06-15', '2026-06-17']))
  })
})

describe('weeksWithDateEvent / weekKey', () => {
  const dateEvent = (extra: Partial<GEvent>): GEvent => ({
    id: 'x',
    summary: 'Date',
    start: { dateTime: '2026-06-17T19:00' }, // Wednesday
    end: { dateTime: '2026-06-17T22:00' },
    ...extra,
  })

  it('buckets a date event and matching days into the same week', () => {
    const weeks = weeksWithDateEvent([dateEvent({})])
    expect(weeks).toEqual(new Set(['2026-06-14'])) // the week's Sunday
    expect(weekKey('2026-06-15')).toBe('2026-06-14')
    expect(weeks.has(weekKey('2026-06-21'))).toBe(false) // next week (Sun starts a new bucket)
  })

  it('ignores cancelled date events', () => {
    expect(weeksWithDateEvent([dateEvent({ status: 'cancelled' })]).size).toBe(0)
  })
})

describe('lastDateEvent / nextDateEvent', () => {
  const now = d('2026-06-15T12:00')
  const ev = (iso: string, extra: Partial<GEvent> = {}): GEvent => ({
    id: iso,
    summary: 'Date',
    start: { dateTime: iso },
    end: { dateTime: iso },
    ...extra,
  })

  it('finds the most recent past date and the soonest future date', () => {
    const events = [ev('2026-05-30T19:00'), ev('2026-06-10T19:00'), ev('2026-06-20T19:00'), ev('2026-07-01T19:00')]
    expect(lastDateEvent(events, now)).toBe('2026-06-10')
    expect(nextDateEvent(events, now)).toBe('2026-06-20')
  })

  it('returns null when there is no past / future date', () => {
    expect(lastDateEvent([ev('2026-06-20T19:00')], now)).toBeNull()
    expect(nextDateEvent([ev('2026-06-10T19:00')], now)).toBeNull()
  })

  it('handles all-day date events and skips cancelled ones', () => {
    const events = [
      { id: 'a', summary: 'Date', start: { date: '2026-06-12' }, end: { date: '2026-06-13' } },
      ev('2026-06-13T19:00', { status: 'cancelled' }),
    ]
    expect(lastDateEvent(events, now)).toBe('2026-06-12')
  })
})

// Mirrors the Free page's "last date" pipeline: a keyword rule (comma keyword,
// scoped to one calendar) → matchRule → lastDateEvent.
describe('last-date pipeline (matchRule → lastDateEvent)', () => {
  const now = d('2026-06-15T12:00')
  const rule = { id: 'd', name: 'Date', keyword: 'Date,date', icon: '❤️', matchDescription: false, calendarIds: ['us'] }

  it('finds a past "Date" on the rule-scoped calendar', () => {
    const events: GEvent[] = [
      { id: '1', summary: 'Date night', calendarId: 'us', start: { dateTime: '2026-05-29T18:00' }, end: { dateTime: '2026-05-29T22:00' } },
      { id: '2', summary: 'Standup', calendarId: 'work', start: { dateTime: '2026-06-01T09:00' }, end: { dateTime: '2026-06-01T10:00' } },
      { id: '3', summary: 'Dinner Date', calendarId: 'personal', start: { dateTime: '2026-06-05T19:00' }, end: { dateTime: '2026-06-05T21:00' } },
    ]
    const matches = matchRule(events, rule)
    // Only the 'us' event is in scope; the 'personal' Date is excluded by scope.
    expect(matches.map((e) => e.id)).toEqual(['1'])
    expect(lastDateEvent(matches, now)).toBe('2026-05-29')
  })
})

describe('rankDateCandidates', () => {
  const overlap = (...pairs: [string, number][]) => new Map(pairs.map(([d, h]) => [d, h * HOUR]))

  it('prefers the more isolated day', () => {
    const blocked = new Set(['2026-06-16'])
    const top = rankDateCandidates(
      ['2026-06-15', '2026-06-20'], // 15 is next to a block (iso 1); 20 is clear (iso 3)
      overlap(['2026-06-15', 5], ['2026-06-20', 5]),
      blocked,
      { count: 1, isolationWindow: 3, preference: 'weekend' },
    )
    expect(top).toEqual(['2026-06-20'])
  })

  it('breaks an isolation tie in favor of the weekend', () => {
    // 2026-06-18 Thu vs 2026-06-20 Sat, equal overlap, nothing blocked.
    const top = rankDateCandidates(
      ['2026-06-18', '2026-06-20'],
      overlap(['2026-06-18', 5], ['2026-06-20', 5]),
      new Set(),
      { count: 1, isolationWindow: 3, preference: 'weekend' },
    )
    expect(top).toEqual(['2026-06-20'])
  })

  it('prefers the weekday when preference is weekday', () => {
    const top = rankDateCandidates(
      ['2026-06-18', '2026-06-20'], // Thu vs Sat
      overlap(['2026-06-18', 5], ['2026-06-20', 5]),
      new Set(),
      { count: 1, isolationWindow: 3, preference: 'weekday' },
    )
    expect(top).toEqual(['2026-06-18'])
  })

  it('ignores day type when preference is either (falls to overlap length)', () => {
    const top = rankDateCandidates(
      ['2026-06-18', '2026-06-20'], // weekday has more overlap than the weekend
      overlap(['2026-06-18', 5], ['2026-06-20', 3]),
      new Set(),
      { count: 1, isolationWindow: 3, preference: 'either' },
    )
    expect(top).toEqual(['2026-06-18'])
  })

  it('breaks an isolation+weekend tie in favor of more mutual free time', () => {
    const top = rankDateCandidates(
      ['2026-06-18', '2026-06-19'], // both weekdays
      overlap(['2026-06-18', 3], ['2026-06-19', 5]),
      new Set(),
      { count: 1, isolationWindow: 3, preference: 'weekend' },
    )
    expect(top).toEqual(['2026-06-19'])
  })

  it('respects count', () => {
    const top = rankDateCandidates(
      ['2026-06-18', '2026-06-25', '2026-07-02'], // three different weeks
      overlap(['2026-06-18', 5], ['2026-06-25', 5], ['2026-07-02', 5]),
      new Set(),
      { count: 2, isolationWindow: 0, preference: 'weekend' },
    )
    expect(top).toHaveLength(2)
  })

  it('recommends at most one day per week', () => {
    // 06-18 and 06-19 are the same week (Sun 06-14 bucket); 06-19 has more overlap.
    const top = rankDateCandidates(
      ['2026-06-18', '2026-06-19'],
      overlap(['2026-06-18', 4], ['2026-06-19', 6]),
      new Set(),
      { count: 3, isolationWindow: 0, preference: 'either' },
    )
    expect(top).toEqual(['2026-06-19'])
  })

  it('avoids back-to-back recommendations across a week boundary', () => {
    // 06-20 is Sat (week 06-14), 06-21 is Sun (week 06-21) — adjacent days.
    const top = rankDateCandidates(
      ['2026-06-20', '2026-06-21'],
      overlap(['2026-06-20', 5], ['2026-06-21', 5]),
      new Set(),
      { count: 2, isolationWindow: 0, preference: 'weekend' },
    )
    expect(top).toEqual(['2026-06-20']) // 06-21 dropped as adjacent
  })

  it('still fills a week with a non-adjacent day when its best is back-to-back', () => {
    // Week 06-21 (Sun 21..Sat 27): Sun 06-21 is adjacent to the Sat 06-20 pick,
    // so the week falls back to its next-best non-adjacent day (06-24).
    const top = rankDateCandidates(
      ['2026-06-20', '2026-06-21', '2026-06-24'],
      overlap(['2026-06-20', 9], ['2026-06-21', 8], ['2026-06-24', 5]),
      new Set(),
      { count: 3, isolationWindow: 0, preference: 'either' },
    )
    expect(top).toEqual(['2026-06-20', '2026-06-24'])
  })
})
