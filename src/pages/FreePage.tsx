import { useCallback, useMemo, useState } from 'react'
import { addDays, endOfDay, startOfDay, startOfMonth } from 'date-fns'
import { eventsToBusy, findFreeSlots, windowKeys, type Slot } from '../lib/availability'
import { applyBlockingRules } from '../lib/metrics'
import { adjustForWork, holidayNote, nextDayWarning, relativeDayLabel, slotBookings } from '../lib/annotate'
import { useSettings } from '../store/settings'
import { useEvents } from '../hooks/useEvents'
import { type DayInfo, type SlotInfo } from '../components/SlotList'
import FreeCalendar from '../components/FreeCalendar'
import { ErrorBanner, Spinner } from '../components/Banner'
import MetricsStats from '../components/MetricsStats'
import { useMetrics } from '../hooks/useMetrics'

export default function FreePage() {
  const [settings] = useSettings()
  const lookahead = settings.lookaheadDays
  // Refresh recomputes "now" too, so stale slots disappear on pull.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [highlightPicks, setHighlightPicks] = useState(true)
  // Metrics follow whichever month card is selected in the calendar.
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const metrics = useMetrics(selectedMonth)
  const startMs = startOfDay(new Date(nowMs)).getTime()
  // Fetch one day past the lookahead so next-day warnings work on the last slot.
  const endMs = addDays(new Date(startMs), lookahead + 1).getTime()

  const { events: rawEvents, loading, error, refresh } = useEvents(startMs, endMs)
  // Events matched by a "blocking" keyword rule lose their Free flag so they
  // count against availability below.
  const events = useMemo(
    () => (rawEvents ? applyBlockingRules(rawEvents, settings.metricRules) : rawEvents),
    [rawEvents, settings.metricRules],
  )
  const holidays = useEvents(startMs, endMs, settings.holidayCalendarIds)

  // Work events don't count toward "partly booked" — they get a "free after
  // work" label instead. Split them out before computing availability.
  const workIds = settings.workCalendarIds
  const { workEvents, nonWorkEvents } = useMemo(() => {
    const work = new Set(workIds)
    const workEvents: typeof events = []
    const nonWorkEvents: typeof events = []
    for (const ev of events ?? []) (ev.calendarId && work.has(ev.calendarId) ? workEvents : nonWorkEvents).push(ev)
    return { workEvents, nonWorkEvents }
  }, [events, workIds])

  const nonWorkBusy = useMemo(() => eventsToBusy(nonWorkEvents ?? []), [nonWorkEvents])
  const workBusy = useMemo(() => eventsToBusy(workEvents ?? []), [workEvents])

  // The "top N" picks: among all days in the lookahead that have a slot meeting
  // the threshold, take the N with the most total free time, then order by date.
  const days = useMemo<[string, Slot[]][]>(() => {
    if (!events) return []
    const found = findFreeSlots(nonWorkBusy, settings.windows, new Date(startMs), addDays(new Date(startMs), lookahead), {
      threshold: settings.freeThreshold,
      now: new Date(nowMs),
    })
    const byDate = new Map<string, Slot[]>()
    for (const slot of found) {
      const a = adjustForWork(slot, workBusy)
      if (!a) continue
      const list = byDate.get(a.date) ?? []
      list.push(a)
      byDate.set(a.date, list)
    }
    const freeMs = (s: Slot[]) => s.reduce((sum, x) => sum + (x.freeTo.getTime() - x.freeFrom.getTime()), 0)
    return [...byDate.entries()]
      .sort(([da, sa], [db, sb]) => freeMs(sb) - freeMs(sa) || da.localeCompare(db))
      .slice(0, settings.freeSlotCount)
      .sort(([da], [db]) => da.localeCompare(db))
  }, [events, nonWorkBusy, workBusy, settings.windows, settings.freeThreshold, settings.freeSlotCount, startMs, nowMs, lookahead])

  // Free slots for any single day (no threshold) — powers the detail card when
  // an arbitrary calendar day is selected.
  const slotsForDate = useCallback(
    (date: string): Slot[] => {
      const day = new Date(date + 'T00:00:00')
      const found = findFreeSlots(nonWorkBusy, settings.windows, day, endOfDay(day), { threshold: 0, now: new Date(nowMs) })
      const out: Slot[] = []
      for (const s of found) {
        const a = adjustForWork(s, workBusy)
        if (a) out.push(a)
      }
      return out
    },
    [nonWorkBusy, workBusy, settings.windows, nowMs],
  )

  // Combined busy (work counts as busy) drives the availability bars.
  const combinedBusy = useMemo(() => eventsToBusy(events ?? []), [events])
  const winKeys = useMemo(() => windowKeys(settings.windows), [settings.windows])

  const dayInfo = useCallback(
    (date: string): DayInfo => ({
      label: relativeDayLabel(new Date(date + 'T12:00:00'), new Date(nowMs)),
      note: holidayNote(holidays.events ?? [], date),
    }),
    [nowMs, holidays.events],
  )

  const slotInfo = useCallback(
    (slot: Slot): SlotInfo => ({
      bookings: slotBookings(nonWorkEvents!, slot, settings.windows),
      warning: slot.window === 'evening' ? nextDayWarning(events ?? [], slot.date) : undefined,
    }),
    [events, nonWorkEvents, settings.windows],
  )

  return (
    <div className="space-y-4">
      <MetricsStats {...metrics} />
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Availability</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHighlightPicks((v) => !v)}
            aria-pressed={highlightPicks}
            title={`${highlightPicks ? 'Hide' : 'Show'} the ${settings.freeSlotCount} most-free days`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              highlightPicks
                ? 'bg-emerald-500 font-medium text-emerald-950'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            ★ Top {settings.freeSlotCount}
          </button>
          <button
            onClick={() => {
              setNowMs(Date.now())
              void refresh()
            }}
            className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm text-slate-700 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:active:bg-slate-700"
          >
            ↻ Refresh
          </button>
        </div>
      </header>
      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}
      {!loading && !error && days.length === 0 && (
        <p className="py-8 text-center text-slate-500 dark:text-slate-400">
          No free slots in the next {lookahead} days. Busy life!
        </p>
      )}
      {!loading && !error && days.length > 0 && (
        <FreeCalendar
          days={days}
          windows={settings.windows}
          busy={combinedBusy}
          now={new Date(nowMs)}
          maxDate={addDays(new Date(startMs), lookahead)}
          dayStart={settings.dayStart}
          highlightPicks={highlightPicks}
          windowOrder={winKeys}
          slotsForDate={slotsForDate}
          dayInfo={dayInfo}
          slotInfo={slotInfo}
          overlay={metrics.overlay}
          selectedMonth={selectedMonth}
          onSelectMonth={(m) => setSelectedMonth(startOfMonth(m))}
        />
      )}
    </div>
  )
}
