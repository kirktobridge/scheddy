import { mergeIntervals, type BusyInterval } from './availability'

export const SNAP_MS = 15 * 60 * 1000
export const MIN_DUR_MS = 30 * 60 * 1000

export interface Span {
  start: Date
  end: Date
}
export interface Win {
  start: Date
  end: Date
}

/** Round a timestamp (ms) to the nearest `step`. */
export function snap(ms: number, step = SNAP_MS): number {
  return Math.round(ms / step) * step
}

const clampMs = (ms: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, ms))

/**
 * Initial booking window: the longest mutual-free gap's start + `minMs`, snapped
 * and clamped to the day span. Falls back to the span start when there's no gap.
 */
export function initialWindow(mutualGaps: BusyInterval[], span: Span, minMs: number): Win {
  const longest = mutualGaps.reduce<BusyInterval | null>(
    (best, g) => (!best || g.end.getTime() - g.start.getTime() > best.end.getTime() - best.start.getTime() ? g : best),
    null,
  )
  const spanStart = span.start.getTime()
  const spanEnd = span.end.getTime()
  const dur = Math.min(minMs, spanEnd - spanStart)
  let start = snap(longest ? longest.start.getTime() : spanStart)
  start = clampMs(start, spanStart, spanEnd - dur)
  return { start: new Date(start), end: new Date(start + dur) }
}

/** Shift the window by `deltaMs`, preserving duration, clamped to the span. */
export function moveWindow(win: Win, deltaMs: number, span: Span): Win {
  const dur = win.end.getTime() - win.start.getTime()
  const spanStart = span.start.getTime()
  const spanEnd = span.end.getTime()
  const start = clampMs(snap(win.start.getTime() + deltaMs), spanStart, spanEnd - dur)
  return { start: new Date(start), end: new Date(start + dur) }
}

/** Move one edge to `toMs` (snapped), enforcing the min duration and span bounds. */
export function resizeWindow(win: Win, edge: 'start' | 'end', toMs: number, span: Span): Win {
  const spanStart = span.start.getTime()
  const spanEnd = span.end.getTime()
  const snapped = clampMs(snap(toMs), spanStart, spanEnd)
  if (edge === 'start') {
    const start = Math.min(snapped, win.end.getTime() - MIN_DUR_MS)
    return { start: new Date(Math.max(spanStart, start)), end: win.end }
  }
  const end = Math.max(snapped, win.start.getTime() + MIN_DUR_MS)
  return { start: win.start, end: new Date(Math.min(spanEnd, end)) }
}

/** The parts of the window that overlap busy time (for conflict highlighting). */
export function conflicts(win: Win, busy: BusyInterval[]): BusyInterval[] {
  const ws = win.start.getTime()
  const we = win.end.getTime()
  const out: BusyInterval[] = []
  for (const b of mergeIntervals(busy)) {
    const s = Math.max(ws, b.start.getTime())
    const e = Math.min(we, b.end.getTime())
    if (e > s) out.push({ start: new Date(s), end: new Date(e) })
  }
  return out
}
