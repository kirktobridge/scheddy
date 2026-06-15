import { describe, expect, it } from 'vitest'
import { applyRuleOverrides, dedupeEvents, matchRule, unbookedEvenings, unbookedWeekendDays } from '../src/lib/metrics'
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

  it('limits matching to the rule\'s calendar scope (empty = all)', () => {
    const events = [ev('Date A', { calendarId: 'mine' }), ev('Date B', { calendarId: 'wife' })]
    expect(matchRule(events, rule()).map((e) => e.summary)).toEqual(['Date A', 'Date B'])
    expect(matchRule(events, rule({ calendarIds: ['wife'] })).map((e) => e.summary)).toEqual(['Date B'])
    expect(matchRule(events, rule({ calendarIds: [] })).map((e) => e.summary)).toEqual(['Date A', 'Date B'])
  })
})

const allDayEv = (summary: string, extra: Partial<GEvent> = {}): GEvent =>
  ev(summary, { start: { date: '2026-06-15' }, end: { date: '2026-06-16' }, ...extra })

describe('applyRuleOverrides', () => {
  it('clears the Free flag on events matched by a blocking rule', () => {
    const events = [ev('Date night', { transparency: 'transparent' }), ev('Gym', { transparency: 'transparent' })]
    const out = applyRuleOverrides(events, [rule({ blocking: true })])
    expect(out[0].transparency).toBeUndefined()
    expect(out[1].transparency).toBe('transparent')
  })

  it('leaves events untouched when no rule overrides', () => {
    const events = [ev('Date night', { transparency: 'transparent' })]
    expect(applyRuleOverrides(events, [rule()])).toBe(events)
  })

  it('respects the calendar scope when forcing blocking', () => {
    const events = [
      ev('Date A', { transparency: 'transparent', calendarId: 'mine' }),
      ev('Date B', { transparency: 'transparent', calendarId: 'wife' }),
    ]
    const out = applyRuleOverrides(events, [rule({ blocking: true, calendarIds: ['wife'] })])
    expect(out[0].transparency).toBe('transparent')
    expect(out[1].transparency).toBeUndefined()
  })

  it('gives matched all-day events concrete times when allDay=block', () => {
    const out = applyRuleOverrides([allDayEv('Date trip')], [rule({ allDay: 'block' })])
    expect(out[0].start?.dateTime).toBe('2026-06-15T00:00:00')
    expect(out[0].end?.dateTime).toBe('2026-06-16T00:00:00')
    // ...and it now contributes a busy interval the global default would have skipped.
    expect(eventsToBusy(out)).toHaveLength(1)
    expect(eventsToBusy([allDayEv('Date trip')])).toHaveLength(0)
  })

  it('marks matched all-day events transparent when allDay=free', () => {
    const out = applyRuleOverrides([allDayEv('Date trip')], [rule({ allDay: 'free' })])
    expect(out[0].transparency).toBe('transparent')
    expect(eventsToBusy(out, { allDay: true })).toHaveLength(0)
  })

  it('blocks all-day matches over free when both overrides apply', () => {
    const rules = [rule({ id: 'a', allDay: 'free' }), rule({ id: 'b', allDay: 'block' })]
    const out = applyRuleOverrides([allDayEv('Date trip')], rules)
    expect(out[0].start?.dateTime).toBe('2026-06-15T00:00:00')
  })
})

describe('eventsToBusy all-day handling', () => {
  it('skips all-day events by default and includes them when allDay is set', () => {
    const events = [allDayEv('Conference')]
    expect(eventsToBusy(events)).toHaveLength(0)
    const busy = eventsToBusy(events, { allDay: true })
    expect(busy).toHaveLength(1)
    expect(busy[0].start).toEqual(new Date('2026-06-15T00:00:00'))
    expect(busy[0].end).toEqual(new Date('2026-06-16T00:00:00'))
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
