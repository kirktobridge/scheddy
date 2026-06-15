import { useCallback, useMemo, useState } from 'react'
import { addDays, endOfDay, isWeekend, startOfDay, startOfMonth } from 'date-fns'
import { blockedDates, eventsToBusy, findFreeSlots, mergeIntervals, rankFreeDays, windowKeys, type Slot } from '../lib/availability'
import { applyRuleOverrides, matchRule } from '../lib/metrics'
import {
  datesInRange,
  notWorkingDates,
  overlapByDate,
  overlapDates,
  overlapInWindowMs,
  rankDateCandidates,
  weekKey,
  weeksWithDateEvent,
} from '../lib/relationship'
import type { OverlayLayer } from '../components/FreeCalendar'
import { adjustForWork, holidayNote, nextDayWarning, relativeDayLabel, slotBookings } from '../lib/annotate'
import { useSettings } from '../store/settings'
import { getColor } from '../lib/colorConfig'
import { useEvents } from '../hooks/useEvents'
import { type DayInfo, type SlotInfo } from '../components/SlotList'
import FreeCalendar from '../components/FreeCalendar'
import { ErrorBanner, Spinner } from '../components/Banner'
import MetricsStats from '../components/MetricsStats'
import { useMetrics } from '../hooks/useMetrics'

export default function FreePage() {
  const [settings, setSettings] = useSettings()
  const lookahead = settings.lookaheadDays
  /** Shared accent for the "Our Overlap" + "Date Options" controls and overlap bar shading. */
  const overlapColor = getColor(settings, 'relationship.overlap')
  const colorFor = (key: string) => settings.metricColors[key] ?? getColor(settings, 'metric.default')
  const setColor = (key: string, color: string) =>
    setSettings({ metricColors: { ...settings.metricColors, [key]: color } })
  // Refresh recomputes "now" too, so stale slots disappear on pull.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [highlightPicks, setHighlightPicks] = useState(true)
  const rel = settings.relationshipMode
  const partnerName = settings.partnerName || 'Partner'
  const [showNotWorking, setShowNotWorking] = useState(false)
  const [showOverlap, setShowOverlap] = useState(false)
  const [showOverlapWeekends, setShowOverlapWeekends] = useState(false)
  const [showOverlapWeeknights, setShowOverlapWeeknights] = useState(false)
  const [showOverlapOffDays, setShowOverlapOffDays] = useState(false)
  const [showDates, setShowDates] = useState(true)
  // Metrics follow whichever month card is selected in the calendar.
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const metrics = useMetrics(selectedMonth)
  const startMs = startOfDay(new Date(nowMs)).getTime()
  // Fetch one day past the lookahead so next-day warnings work on the last slot,
  // plus the isolation window so forward spacing is accurate at the end of the span.
  const endMs = addDays(new Date(startMs), lookahead + settings.isolationWindowDays + 1).getTime()

  const { events: rawEvents, loading, error, refresh } = useEvents(startMs, endMs)
  // Keyword-rule overrides (force-block Free events, per-rule all-day flips)
  // are baked into the events before they become busy intervals below.
  const events = useMemo(
    () => (rawEvents ? applyRuleOverrides(rawEvents, settings.metricRules) : rawEvents),
    [rawEvents, settings.metricRules],
  )
  const holidays = useEvents(startMs, endMs, settings.holidayCalendarIds)

  // Relationship mode: pull the partner's busy/work calendars and the shared
  // "joint" calendar. Pass [] when off so the hook stays idle (no fetch, no error).
  const partner = useEvents(startMs, endMs, rel ? settings.partnerBlockingCalendarIds : [])
  const partnerWork = useEvents(startMs, endMs, rel ? settings.partnerWorkCalendarIds : [])
  const joint = useEvents(startMs, endMs, rel ? settings.jointCalendarIds : [])

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

  const allDay = settings.blockAllDayEvents
  const nonWorkBusy = useMemo(() => eventsToBusy(nonWorkEvents ?? [], { allDay }), [nonWorkEvents, allDay])
  const workBusy = useMemo(() => eventsToBusy(workEvents ?? [], { allDay }), [workEvents, allDay])

  // The "top N" picks: among all days in the lookahead that have a slot meeting
  // the threshold, rank by isolation from other blocking events, then total free
  // time, then weekends (see rankFreeDays), and order the result by date.
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
    return rankFreeDays([...byDate.entries()], blockedDates(nonWorkBusy), {
      count: settings.freeSlotCount,
      isolationWindow: settings.isolationWindowDays,
      favorWeekends: settings.favorWeekends,
    })
  }, [
    events,
    nonWorkBusy,
    workBusy,
    settings.windows,
    settings.freeThreshold,
    settings.freeSlotCount,
    settings.isolationWindowDays,
    settings.favorWeekends,
    startMs,
    nowMs,
    lookahead,
  ])

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
  const combinedBusy = useMemo(() => eventsToBusy(events ?? [], { allDay }), [events, allDay])
  const winKeys = useMemo(() => windowKeys(settings.windows), [settings.windows])

  // Relationship overlays: the partner's non-working days, days with enough
  // mutual free time, and the top date-night candidates. Joint events block both
  // partners, so they fold into each side's busy.
  const relationship = useMemo(() => {
    const empty = {
      notWorkingSet: new Set<string>(),
      overlapWeekendSet: new Set<string>(),
      overlapWeeknightSet: new Set<string>(),
      bothOffSet: new Set<string>(),
      dateSet: new Set<string>(),
      overlapBusy: [] as ReturnType<typeof mergeIntervals>,
    }
    if (!rel) return empty
    const HOUR = 60 * 60 * 1000
    const jointBusy = eventsToBusy(joint.events ?? [], { allDay })
    const partnerBusy = mergeIntervals([...eventsToBusy(partner.events ?? [], { allDay }), ...jointBusy])
    const partnerWorkBusy = eventsToBusy(partnerWork.events ?? [], { allDay })
    const myBusy = mergeIntervals([...combinedBusy, ...jointBusy])
    const dates = datesInRange(new Date(startMs), addDays(new Date(startMs), lookahead))

    const overlap = overlapByDate(myBusy, partnerBusy, settings.windows, dates, settings.dayStart)
    const notWorkingSet = notWorkingDates(partnerWorkBusy, dates)
    const overlapSet = overlapDates(overlap, settings.overlapMinHours * HOUR)

    // Overlap subsets the mini-section can scope the highlight to:
    const minMs = settings.overlapMinHours * HOUR
    const isWknd = (d: string) => isWeekend(new Date(d + 'T12:00:00'))
    const myOff = notWorkingDates(workBusy, dates)
    const overlapWeekendSet = new Set(dates.filter((d) => isWknd(d) && overlapSet.has(d)))
    const overlapWeeknightSet = new Set(
      dates.filter((d) => !isWknd(d) && overlapInWindowMs(myBusy, partnerBusy, settings.windows, 'evening', d) + 1e-9 >= minMs),
    )
    const bothOffSet = new Set(dates.filter((d) => myOff.has(d) && notWorkingSet.has(d)))

    // Date candidates: days with enough mutual free time, in weeks that don't
    // already have a date booked, ranked by isolation from either partner's
    // commitments, then weekends, then most mutual free time.
    const eligible = [...overlapDates(overlap, settings.dateMinHours * HOUR)]
    const dateRule = settings.metricRules.find((r) => r.id === settings.dateRuleId)
    const dateEvents = dateRule
      ? matchRule([...(events ?? []), ...(joint.events ?? []), ...(partner.events ?? [])], dateRule)
      : []
    const bookedWeeks = weeksWithDateEvent(dateEvents)
    const candidates = eligible.filter((d) => !bookedWeeks.has(weekKey(d)))
    const overlapBusy = mergeIntervals([...myBusy, ...partnerBusy])
    const blocked = blockedDates(overlapBusy)
    const dateSet = new Set(
      rankDateCandidates(candidates, overlap, blocked, {
        count: settings.dateCandidateCount,
        isolationWindow: settings.isolationWindowDays,
        preference: settings.datePreference,
      }),
    )
    return { notWorkingSet, overlapWeekendSet, overlapWeeknightSet, bothOffSet, dateSet, overlapBusy }
  }, [
    rel,
    allDay,
    partner.events,
    partnerWork.events,
    joint.events,
    combinedBusy,
    workBusy,
    events,
    settings.windows,
    settings.dayStart,
    settings.overlapMinHours,
    settings.dateMinHours,
    settings.dateCandidateCount,
    settings.isolationWindowDays,
    settings.datePreference,
    settings.dateRuleId,
    settings.metricRules,
    startMs,
    lookahead,
  ])

  // Days the overlap highlight covers = union of whichever subset chips are on.
  const overlapHighlight = useMemo(() => {
    const set = new Set<string>()
    if (!rel || !showOverlap) return set
    if (showOverlapWeekends) relationship.overlapWeekendSet.forEach((d) => set.add(d))
    if (showOverlapWeeknights) relationship.overlapWeeknightSet.forEach((d) => set.add(d))
    if (showOverlapOffDays) relationship.bothOffSet.forEach((d) => set.add(d))
    return set
  }, [rel, showOverlap, showOverlapWeekends, showOverlapWeeknights, showOverlapOffDays, relationship])

  const layers = useMemo<OverlayLayer[]>(() => {
    if (!rel) return []
    const out: OverlayLayer[] = []
    if (showNotWorking) out.push({ key: 'not-working', dates: relationship.notWorkingSet, color: getColor(settings, 'relationship.partnerOff'), style: 'tint' })
    if (showOverlap && overlapHighlight.size) out.push({ key: 'overlap', dates: overlapHighlight, color: overlapColor, style: 'ring' })
    if (showDates) out.push({ key: 'dates', dates: relationship.dateSet, color: getColor(settings, 'relationship.dateMarker'), style: 'marker', mark: '❤️' })
    return out
  }, [rel, showNotWorking, showOverlap, showDates, overlapHighlight, relationship, settings, overlapColor])

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
      <MetricsStats {...metrics} colorFor={colorFor} onColor={setColor} />
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
          {rel && (
            <div className="flex flex-col gap-1 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Me &amp; {partnerName}</span>
                <RelToggle active={showNotWorking} onClick={() => setShowNotWorking((v) => !v)} title={`Days ${partnerName} isn't working`} color="bg-blue-500 text-blue-950">
                  {partnerName}'s Off Days
                </RelToggle>
                <RelToggle active={showOverlap} onClick={() => setShowOverlap((v) => !v)} title="Highlight overlapping availability" color="bg-pink-500 text-pink-950">
                  ⇄ Our Overlap
                </RelToggle>
                <RelToggle active={showDates} onClick={() => setShowDates((v) => !v)} title={`Top ${settings.dateCandidateCount} date candidates`} color="bg-pink-500 text-pink-950">
                  ❤️ Date Options
                </RelToggle>
              </div>
              {showOverlap && (
                <div className="flex items-center gap-1.5 border-t border-slate-200 pt-1 dark:border-slate-700">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Overlap</span>
                  <RelToggle active={showOverlapWeekends} onClick={() => setShowOverlapWeekends((v) => !v)} title="Weekend days with mutual free time" color="bg-pink-500 text-pink-950">
                    Weekends
                  </RelToggle>
                  <RelToggle active={showOverlapWeeknights} onClick={() => setShowOverlapWeeknights((v) => !v)} title="Weekday evenings with mutual free time" color="bg-pink-500 text-pink-950">
                    Weeknights
                  </RelToggle>
                  <RelToggle active={showOverlapOffDays} onClick={() => setShowOverlapOffDays((v) => !v)} title="Days you're both off work" color="bg-pink-500 text-pink-950">
                    Off days
                  </RelToggle>
                </div>
              )}
            </div>
          )}
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
          overlayColor={metrics.activeKey ? colorFor(metrics.activeKey) : undefined}
          layers={layers}
          overlapBusy={showOverlap ? relationship.overlapBusy : undefined}
          overlapShadeColor={overlapColor}
          overlapShadeDates={overlapHighlight}
          selectedMonth={selectedMonth}
          onSelectMonth={(m) => setSelectedMonth(startOfMonth(m))}
        />
      )}
    </div>
  )
}

/** Relationship-mode overlay toggle — mirrors the "★ Top N" button styling. */
function RelToggle({
  active,
  onClick,
  title,
  color,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  /** Tailwind bg+text classes for the active state. */
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`rounded-md px-2 py-1 text-xs ${
        active ? `${color} font-medium` : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {children}
    </button>
  )
}
