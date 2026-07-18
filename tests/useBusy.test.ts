// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBusy } from '../src/hooks/useBusy'
import type { GEvent } from '../src/api/calendar'
import { DEFAULT_SETTINGS, updateSettings } from '../src/store/settings'

/** A timed, blocking event on a given calendar. */
function ev(calendarId: string, start: string, end: string): GEvent {
  return { id: `${calendarId}-${start}`, calendarId, start: { dateTime: start }, end: { dateTime: end } }
}

afterEach(() => updateSettings(DEFAULT_SETTINGS))

describe('useBusy (B-09 extraction)', () => {
  it('splits work vs non-work events and combines them', () => {
    updateSettings({ ...DEFAULT_SETTINGS, workCalendarIds: ['work'] })
    const events = [
      ev('personal', '2026-07-20T18:00:00', '2026-07-20T19:00:00'),
      ev('work', '2026-07-20T09:00:00', '2026-07-20T17:00:00'),
    ]
    const { result } = renderHook(() => useBusy(events, [], []))

    // Non-work events exclude the work-calendar entry.
    expect(result.current.nonWorkEvents.map((e) => e.calendarId)).toEqual(['personal'])
    expect(result.current.workBusy).toHaveLength(1)
    expect(result.current.nonWorkBusy).toHaveLength(1)
    // Combined busy carries both (disjoint → two intervals).
    expect(result.current.combinedBusy).toHaveLength(2)
  })

  it('merges partner + joint streams into partnerBusy', () => {
    const partnerEvents = [ev('partner', '2026-07-20T12:00:00', '2026-07-20T13:00:00')]
    const jointEvents = [ev('joint', '2026-07-20T20:00:00', '2026-07-20T21:00:00')]
    const { result } = renderHook(() => useBusy([], partnerEvents, jointEvents))

    expect(result.current.jointBusy).toHaveLength(1)
    // partnerBusy is the merge of partner + joint (disjoint here → two).
    expect(result.current.partnerBusy).toHaveLength(2)
  })
})
