import { describe, expect, it } from 'vitest'
import {
  allDayOn,
  blocksAny,
  roleOf,
  toggleAllDay,
  toggleBlocking,
  toggleInArray,
  toggleJoint,
  togglePartnerBlocking,
  togglePartnerWork,
  toggleWork,
} from '../src/lib/calendarRoles'
import { DEFAULT_SETTINGS, type Settings } from '../src/store/settings'

const make = (patch: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...patch })

describe('toggleInArray', () => {
  it('adds when absent, removes when present', () => {
    expect(toggleInArray(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleInArray(['a', 'b'], 'b')).toEqual(['a'])
  })
})

describe('toggleBlocking', () => {
  it('adds a calendar to blocking', () => {
    const s = make({ blockingCalendarIds: [] })
    expect(toggleBlocking(s, 'x')).toEqual({ blockingCalendarIds: ['x'] })
  })

  it('removing blocking also strips the work flag (work ⊆ blocking)', () => {
    const s = make({ blockingCalendarIds: ['x'], workCalendarIds: ['x'] })
    expect(toggleBlocking(s, 'x')).toEqual({
      blockingCalendarIds: [],
      workCalendarIds: [],
    })
  })
})

describe('toggleWork', () => {
  it('is a no-op unless the calendar already blocks', () => {
    const s = make({ blockingCalendarIds: [], workCalendarIds: [] })
    expect(toggleWork(s, 'x')).toEqual({})
  })

  it('toggles work when the calendar blocks', () => {
    const s = make({ blockingCalendarIds: ['x'], workCalendarIds: [] })
    expect(toggleWork(s, 'x')).toEqual({ workCalendarIds: ['x'] })
    const s2 = make({ blockingCalendarIds: ['x'], workCalendarIds: ['x'] })
    expect(toggleWork(s2, 'x')).toEqual({ workCalendarIds: [] })
  })
})

describe('togglePartnerBlocking', () => {
  it('removing partner-blocking clears partner-work and joint', () => {
    const s = make({
      partnerBlockingCalendarIds: ['x'],
      partnerWorkCalendarIds: ['x'],
      jointCalendarIds: ['x'],
    })
    expect(togglePartnerBlocking(s, 'x')).toEqual({
      partnerBlockingCalendarIds: [],
      partnerWorkCalendarIds: [],
      jointCalendarIds: [],
    })
  })
})

describe('togglePartnerWork', () => {
  it('is a no-op unless the calendar is partner-blocking', () => {
    const s = make({ partnerBlockingCalendarIds: [], partnerWorkCalendarIds: [] })
    expect(togglePartnerWork(s, 'x')).toEqual({})
  })
})

describe('toggleJoint', () => {
  it('marking joint implies partner-blocking', () => {
    const s = make({ jointCalendarIds: [], partnerBlockingCalendarIds: [] })
    expect(toggleJoint(s, 'x')).toEqual({
      jointCalendarIds: ['x'],
      partnerBlockingCalendarIds: ['x'],
    })
  })

  it('does not duplicate an existing partner-blocking entry', () => {
    const s = make({ jointCalendarIds: [], partnerBlockingCalendarIds: ['x'] })
    expect(toggleJoint(s, 'x')).toEqual({
      jointCalendarIds: ['x'],
      partnerBlockingCalendarIds: ['x'],
    })
  })

  it('unmarking joint leaves partner-blocking intact', () => {
    const s = make({ jointCalendarIds: ['x'], partnerBlockingCalendarIds: ['x'] })
    expect(toggleJoint(s, 'x')).toEqual({ jointCalendarIds: [] })
  })
})

describe('toggleAllDay', () => {
  it('toggles per-calendar all-day opt-in', () => {
    const s = make({ allDayBlockingCalendarIds: [] })
    expect(toggleAllDay(s, 'x')).toEqual({ allDayBlockingCalendarIds: ['x'] })
  })
})

describe('blocksAny', () => {
  it('is true for any blocking capacity', () => {
    expect(blocksAny(make({ blockingCalendarIds: ['x'] }), 'x')).toBe(true)
    expect(blocksAny(make({ partnerBlockingCalendarIds: ['x'] }), 'x')).toBe(true)
    expect(blocksAny(make({ jointCalendarIds: ['x'] }), 'x')).toBe(true)
    expect(blocksAny(make({}), 'x')).toBe(false)
  })
})

describe('allDayOn', () => {
  it('honors the global flag or the per-calendar opt-in', () => {
    expect(allDayOn(make({ blockAllDayEvents: true }), 'x')).toBe(true)
    expect(allDayOn(make({ allDayBlockingCalendarIds: ['x'] }), 'x')).toBe(true)
    expect(allDayOn(make({}), 'x')).toBe(false)
  })
})

describe('roleOf', () => {
  it('blocking wins over everything', () => {
    expect(roleOf(make({ blockingCalendarIds: ['x'], holidayCalendarIds: ['x'] }), 'x')).toBe('blocking')
  })

  it('any non-blocking role is "other"', () => {
    expect(roleOf(make({ holidayCalendarIds: ['x'] }), 'x')).toBe('other')
    expect(roleOf(make({ jointCalendarIds: ['x'] }), 'x')).toBe('other')
  })

  it('no role is "unused"', () => {
    expect(roleOf(make({}), 'x')).toBe('unused')
  })
})
