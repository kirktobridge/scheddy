import { describe, expect, it } from 'vitest'
import {
  MIN_DUR_MS,
  conflicts,
  initialWindow,
  moveWindow,
  resizeWindow,
  snap,
  type Span,
} from '../src/lib/planWindow'
import type { BusyInterval } from '../src/lib/availability'

const d = (iso: string) => new Date(iso)
const span: Span = { start: d('2026-06-20T09:00'), end: d('2026-06-20T23:00') }
const HOUR = 3_600_000

describe('snap', () => {
  it('rounds to the nearest 15 minutes', () => {
    expect(snap(d('2026-06-20T18:07').getTime())).toBe(d('2026-06-20T18:00').getTime())
    expect(snap(d('2026-06-20T18:08').getTime())).toBe(d('2026-06-20T18:15').getTime())
  })
})

describe('initialWindow', () => {
  it('starts at the longest mutual gap, sized to minMs', () => {
    const gaps: BusyInterval[] = [
      { start: d('2026-06-20T09:00'), end: d('2026-06-20T10:00') }, // 1h
      { start: d('2026-06-20T18:00'), end: d('2026-06-20T23:00') }, // 5h ← longest
    ]
    const w = initialWindow(gaps, span, 3 * HOUR)
    expect(w.start).toEqual(d('2026-06-20T18:00'))
    expect(w.end).toEqual(d('2026-06-20T21:00'))
  })

  it('falls back to span start with no gaps and clamps the duration to the span', () => {
    const w = initialWindow([], span, 3 * HOUR)
    expect(w.start).toEqual(span.start)
    expect(w.end).toEqual(d('2026-06-20T12:00'))
  })
})

describe('moveWindow', () => {
  const win = { start: d('2026-06-20T18:00'), end: d('2026-06-20T21:00') }

  it('shifts preserving duration and snaps', () => {
    const w = moveWindow(win, 67 * 60 * 1000, span) // +1h07 → snaps to +1h00 (start 19:00)
    expect(w.start).toEqual(d('2026-06-20T19:00'))
    expect(w.end).toEqual(d('2026-06-20T22:00'))
  })

  it('clamps to the span end without shrinking', () => {
    const w = moveWindow(win, 10 * HOUR, span)
    expect(w.end).toEqual(span.end)
    expect(w.end.getTime() - w.start.getTime()).toBe(3 * HOUR)
  })
})

describe('resizeWindow', () => {
  const win = { start: d('2026-06-20T18:00'), end: d('2026-06-20T21:00') }

  it('moves the end edge', () => {
    const w = resizeWindow(win, 'end', d('2026-06-20T22:30').getTime(), span)
    expect(w.start).toEqual(win.start)
    expect(w.end).toEqual(d('2026-06-20T22:30'))
  })

  it('enforces the minimum duration', () => {
    const w = resizeWindow(win, 'end', d('2026-06-20T18:05').getTime(), span)
    expect(w.end.getTime() - w.start.getTime()).toBe(MIN_DUR_MS)
  })
})

describe('conflicts', () => {
  it('returns the window∩busy overlaps only', () => {
    const win = { start: d('2026-06-20T18:00'), end: d('2026-06-20T21:00') }
    const busy: BusyInterval[] = [
      { start: d('2026-06-20T17:00'), end: d('2026-06-20T19:00') }, // overlaps 18–19
      { start: d('2026-06-20T22:00'), end: d('2026-06-20T23:00') }, // outside
    ]
    expect(conflicts(win, busy)).toEqual([{ start: d('2026-06-20T18:00'), end: d('2026-06-20T19:00') }])
  })

  it('is empty when the window is clear', () => {
    const win = { start: d('2026-06-20T20:00'), end: d('2026-06-20T22:00') }
    expect(conflicts(win, [{ start: d('2026-06-20T09:00'), end: d('2026-06-20T10:00') }])).toEqual([])
  })
})
