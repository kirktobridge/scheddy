import { useMemo, useState } from 'react'
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
import { eventsToBusy, findFreeSlots, WINDOW_KEYS, type WindowKey } from '../lib/availability'
import { useSettings } from '../store/settings'
import { useEvents } from '../hooks/useEvents'
import SlotList from '../components/SlotList'
import EventList from '../components/EventList'
import { ErrorBanner, Spinner } from '../components/Banner'

type Preset = 'today' | 'tomorrow' | 'weekend' | 'nextweek' | 'month'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'nextweek', label: 'Next week' },
  { id: 'month', label: 'This month' },
]

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

type Mode = { kind: 'preset'; preset: Preset } | { kind: 'month'; iso: string } | { kind: 'custom' }

export default function CheckPage() {
  const [settings] = useSettings()
  const now = new Date()
  const [mode, setMode] = useState<Mode>({ kind: 'preset', preset: 'weekend' })
  const [customStart, setCustomStart] = useState(format(now, 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(addDays(now, 7), 'yyyy-MM-dd'))
  const [windowFilter, setWindowFilter] = useState<WindowKey[]>([...WINDOW_KEYS])

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = addMonths(startOfMonth(now), i)
        return { iso: format(m, 'yyyy-MM'), label: format(m, 'MMMM yyyy') }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format(now, 'yyyy-MM')],
  )

  const [rangeStart, rangeEnd] = useMemo((): [Date, Date] => {
    if (mode.kind === 'preset') return presetRange(mode.preset, now)
    if (mode.kind === 'month') {
      const first = new Date(mode.iso + '-01T12:00:00')
      const start = startOfMonth(first) < now ? startOfDay(now) : startOfMonth(first)
      return [start, endOfMonth(first)]
    }
    const start = startOfDay(new Date(customStart + 'T12:00:00'))
    const end = endOfDay(new Date(customEnd + 'T12:00:00'))
    return [start, end < start ? endOfDay(start) : end]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, customStart, customEnd, format(now, 'yyyy-MM-dd')])

  const { events, loading, error } = useEvents(rangeStart.getTime(), rangeEnd.getTime())

  const slots = useMemo(() => {
    if (!events) return []
    return findFreeSlots(eventsToBusy(events), settings.windows, rangeStart, rangeEnd, {
      threshold: settings.freeThreshold,
      now,
      windowFilter,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, settings.windows, settings.freeThreshold, rangeStart.getTime(), rangeEnd.getTime(), windowFilter])

  const booked = useMemo(
    () => (events ?? []).filter((ev) => ev.status !== 'cancelled' && ev.transparency !== 'transparent'),
    [events],
  )

  const toggleWindow = (key: WindowKey) =>
    setWindowFilter((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
      return next.length === 0 ? cur : WINDOW_KEYS.filter((k) => next.includes(k))
    })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Am I free?</h1>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setMode({ kind: 'preset', preset: p.id })}
            className={`rounded-full px-3 py-1.5 text-sm ${
              mode.kind === 'preset' && mode.preset === p.id
                ? 'bg-emerald-500 font-medium text-emerald-950'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={mode.kind === 'month' ? mode.iso : ''}
          onChange={(e) => e.target.value && setMode({ kind: 'month', iso: e.target.value })}
          className={`flex-1 rounded-lg border border-slate-700 px-3 py-2 text-sm ${
            mode.kind === 'month' ? 'bg-emerald-500 font-medium text-emerald-950' : 'bg-slate-800 text-slate-300'
          }`}
        >
          <option value="">Pick a month…</option>
          {monthOptions.map((m) => (
            <option key={m.iso} value={m.iso}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setMode({ kind: 'custom' })}
          className={`rounded-lg px-3 py-2 text-sm ${
            mode.kind === 'custom' ? 'bg-emerald-500 font-medium text-emerald-950' : 'bg-slate-800 text-slate-300'
          }`}
        >
          Custom…
        </button>
      </div>

      {mode.kind === 'custom' && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-slate-200"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-slate-200"
          />
        </div>
      )}

      <div className="flex gap-2">
        {WINDOW_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => toggleWindow(key)}
            className={`flex-1 rounded-full px-2 py-1.5 text-sm capitalize ${
              windowFilter.includes(key) ? 'bg-slate-700 font-medium text-slate-100' : 'bg-slate-800/50 text-slate-500'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-400">
        Showing {format(rangeStart, 'EEE, MMM d')} – {format(rangeEnd, 'EEE, MMM d')}
      </p>

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}
      {!loading && !error && (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-emerald-400 uppercase">Free</h2>
            <SlotList slots={slots} emptyText="No free slots in this range." />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-rose-400 uppercase">Already booked</h2>
            <EventList events={booked} />
          </section>
        </>
      )}
    </div>
  )
}
