import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  format,
  isSaturday,
  isSunday,
  nextMonday,
  nextSaturday,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import { windowKeys, type WindowKey, type Windows } from '../lib/availability'

export type Preset = 'today' | 'tomorrow' | 'weekend' | 'nextweek' | 'month'

export const QUERY_PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'nextweek', label: 'Next week' },
  { id: 'month', label: 'This month' },
]

export type QueryMode =
  | { kind: 'idle' }
  | { kind: 'preset'; preset: Preset }
  | { kind: 'month'; iso: string }
  | { kind: 'custom' }

function presetRange(preset: Preset, now: Date): [Date, Date] {
  switch (preset) {
    case 'today':
      return [startOfDay(now), endOfDay(now)]
    case 'tomorrow': {
      const t = addDays(now, 1)
      return [startOfDay(t), endOfDay(t)]
    }
    case 'weekend': {
      if (isSunday(now)) return [startOfDay(now), endOfDay(now)]
      const sat = isSaturday(now) ? now : nextSaturday(now)
      return [startOfDay(sat), endOfDay(addDays(startOfDay(sat), 1))]
    }
    case 'nextweek': {
      const mon = nextMonday(now)
      return [startOfDay(mon), endOfDay(addDays(mon, 6))]
    }
    case 'month':
      return [startOfDay(now), endOfMonth(now)]
  }
}

export interface QueryState {
  mode: QueryMode
  /** True while a query is active (mode !== idle) — the canvas is in query mode. */
  active: boolean
  /** Resolved query range, clamped to the canvas horizon [today, maxDate]; null when idle. */
  range: [Date, Date] | null
  windowFilter: WindowKey[]
  /** Relationship-mode "Both of us" toggle: compute against mutual-free time. */
  bothOfUs: boolean
  customStart: string
  customEnd: string
  /** Whole-month options within the canvas horizon (start..maxDate). */
  monthOptions: { iso: string; label: string }[]
  setPreset: (preset: Preset) => void
  setMonth: (iso: string) => void
  setCustom: () => void
  setCustomStart: (v: string) => void
  setCustomEnd: (v: string) => void
  toggleWindow: (key: WindowKey) => void
  setBothOfUs: (v: boolean) => void
  clear: () => void
}

/**
 * State for the query layer that replaced CheckPage (B-24): a lens over the Free
 * canvas rather than a separate page. Idle = today's calendar behavior; an active
 * query resolves a date range (clamped to the canvas horizon) that the page uses
 * to filter and highlight the calendar and to list matching free slots.
 *
 * `maxMs` is the canvas's last valid day (startMs + lookahead); ranges never
 * extend past it, so the query always operates on already-loaded data — one fetch,
 * no separate range fetch as CheckPage did.
 */
export function useQueryMode(nowMs: number, maxMs: number, windows: Windows): QueryState {
  const winKeys = useMemo(() => windowKeys(windows), [windows])
  const now = useMemo(() => new Date(nowMs), [nowMs])
  const [mode, setMode] = useState<QueryMode>({ kind: 'idle' })
  const [customStart, setCustomStart] = useState(() => format(now, 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(() => format(addDays(now, 7), 'yyyy-MM-dd'))
  const [windowFilter, setWindowFilter] = useState<WindowKey[]>(() => winKeys)
  const [bothOfUs, setBothOfUs] = useState(false)

  // Keep the window filter consistent as the configured windows change.
  useEffect(() => {
    setWindowFilter((cur) => {
      const next = winKeys.filter((k) => cur.includes(k))
      return next.length ? next : winKeys
    })
  }, [winKeys])

  const monthOptions = useMemo(() => {
    const out: { iso: string; label: string }[] = []
    const last = startOfMonth(new Date(maxMs))
    for (let m = startOfMonth(now); m.getTime() <= last.getTime(); m = addMonths(m, 1)) {
      out.push({ iso: format(m, 'yyyy-MM'), label: format(m, 'MMMM yyyy') })
    }
    return out
  }, [now, maxMs])

  const range = useMemo((): [Date, Date] | null => {
    if (mode.kind === 'idle') return null
    let start: Date
    let end: Date
    if (mode.kind === 'preset') {
      ;[start, end] = presetRange(mode.preset, now)
    } else if (mode.kind === 'month') {
      const first = new Date(mode.iso + '-01T12:00:00')
      start = startOfMonth(first) < now ? startOfDay(now) : startOfMonth(first)
      end = endOfMonth(first)
    } else {
      start = startOfDay(new Date(customStart + 'T12:00:00'))
      const e = endOfDay(new Date(customEnd + 'T12:00:00'))
      end = e < start ? endOfDay(start) : e
    }
    // Clamp to the canvas horizon so the query always lands on loaded data.
    const lo = startOfDay(now).getTime()
    const cs = new Date(Math.max(start.getTime(), lo))
    const ce = new Date(Math.min(end.getTime(), maxMs))
    return ce.getTime() < cs.getTime() ? [cs, endOfDay(cs)] : [cs, ce]
  }, [mode, customStart, customEnd, now, maxMs])

  const toggleWindow = useCallback(
    (key: WindowKey) =>
      setWindowFilter((cur) => {
        const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
        return next.length === 0 ? cur : winKeys.filter((k) => next.includes(k))
      }),
    [winKeys],
  )

  const setPreset = useCallback((preset: Preset) => setMode({ kind: 'preset', preset }), [])
  const setMonth = useCallback((iso: string) => setMode({ kind: 'month', iso }), [])
  const setCustom = useCallback(() => setMode({ kind: 'custom' }), [])
  const clear = useCallback(() => setMode({ kind: 'idle' }), [])

  return {
    mode,
    active: mode.kind !== 'idle',
    range,
    windowFilter,
    bothOfUs,
    customStart,
    customEnd,
    monthOptions,
    setPreset,
    setMonth,
    setCustom,
    setCustomStart,
    setCustomEnd,
    toggleWindow,
    setBothOfUs,
    clear,
  }
}
