import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, differenceInCalendarDays, endOfDay, endOfMonth, format, isSameMonth, isWeekend, startOfDay, startOfMonth } from 'date-fns'
import { blockedDates, dayIsolation, eventsToBusy, findFreeSlots, mergeIntervals, rankFreeDays, windowKeys, type Slot } from '../lib/availability'
import { applyRuleOverrides, buildBusy, matchRule } from '../lib/metrics'
import {
  datesInRange,
  lastDateEvent,
  nextDateEvent,
  notWorkingDates,
  overlapByDate,
  overlapDates,
  overlapInWindowMs,
  rankDateCandidates,
  resolveDateRule,
  weekKey,
  weeksWithDateEvent,
} from '../lib/relationship'
import type { OverlayLayer } from '../components/FreeCalendar'
import { adjustForWork, holidayNote, nextDayWarning, relativeDayLabel, slotBookings } from '../lib/annotate'
import { useSettings } from '../store/settings'
import { getColor } from '../lib/designTokens'
import { mixColors } from '../lib/colorMix'
import { createEvent } from '../api/calendar'
import { useEvents } from '../hooks/useEvents'
import { useHorizon } from '../hooks/useHorizon'
import { useCalendars } from '../hooks/useCalendars'
import { eventsForDay } from '../lib/format'
import { type DayInfo, type SlotInfo } from '../components/SlotList'
import FreeCalendar from '../components/FreeCalendar'
import DayTimelineCard from '../components/DayTimelineCard'
import BottomSheet from '../components/BottomSheet'
import { ErrorBanner, Spinner } from '../components/Banner'
import MetricsStats from '../components/MetricsStats'
import RelationshipStats from '../components/RelationshipStats'
import { useMetrics } from '../hooks/useMetrics'
import { useMediaQuery } from '../hooks/useMediaQuery'

/** How far back to scan for the most recent past date (cadence nudge). */
const DATE_LOOKBACK_DAYS = 365

export default function FreePage({ refreshTick = 0 }: { refreshTick?: number }) {
  const [settings, setSettings] = useSettings()
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
  // Per-date highlight color for the lit metrics. Days counted by several active
  // metrics get the RYB blend of their colors (e.g. blue + yellow = green).
  const metricOverlay = useMemo(() => {
    const perDate = new Map<string, string[]>()
    for (const key of metrics.activeKeys) {
      const color = colorFor(key)
      for (const date of metrics.dateSets.get(key) ?? []) {
        perDate.set(date, [...(perDate.get(date) ?? []), color])
      }
    }
    const blended = new Map<string, string>()
    for (const [date, colors] of perDate) {
      const mixed = mixColors(colors)
      if (mixed) blended.set(date, mixed)
    }
    return blended
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics.activeKeys, metrics.dateSets, settings.metricColors])
  // Selected day (yyyy-MM-dd) drives the day-detail card stacked below metrics.
  const [selected, setSelected] = useState<string | undefined>(undefined)
  // xl: a right-side panel replaces the stacked day card / top metrics.
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  // Free view horizon: clamp(minHorizonDays, last horizon-calendar event, maxHorizonDays).
  const { lookahead } = useHorizon(nowMs)
  const startMs = startOfDay(new Date(nowMs)).getTime()
  // Fetch one day past the lookahead so next-day warnings work on the last slot,
  // plus the isolation window so forward spacing is accurate at the end of the span.
  const endMs = addDays(new Date(startMs), lookahead + settings.isolationWindowDays + 1).getTime()

  const { events: rawEvents, loading, error, refresh } = useEvents(startMs, endMs)
  // The Refresh control lives in the nav (App); it bumps refreshTick. Re-fetch and
  // reset "now" when it changes, skipping the initial mount (data already loads then).
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    setNowMs(Date.now())
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick])
  // Keyword-rule overrides (force-block Free events, per-rule all-day flips)
  // are baked into the events before they become busy intervals below.
  const events = useMemo(
    () => (rawEvents ? applyRuleOverrides(rawEvents, settings.metricRules) : rawEvents),
    [rawEvents, settings.metricRules],
  )
  const holidays = useEvents(startMs, endMs, settings.holidayCalendarIds)

  // Raw events (no rule overrides) for the selected-day schedule, scoped to the
  // "Show events" calendars. Empty selection stays idle. Calendar colors drive
  // the per-row dots.
  const dayEventStream = useEvents(startMs, endMs, settings.dayEventCalendarIds)
  const calendars = useCalendars()
  const calColors = useMemo(
    () => new Map((calendars ?? []).map((c) => [c.id, c.backgroundColor])),
    [calendars],
  )
  const eventsForDate = useCallback(
    (date: string) => eventsForDay(dayEventStream.events ?? [], date),
    [dayEventStream.events],
  )

  // Relationship mode: pull the partner's busy/work calendars and the shared
  // "joint" calendar. Pass [] when off so the hook stays idle (no fetch, no error).
  const partner = useEvents(startMs, endMs, rel ? settings.partnerBlockingCalendarIds : [])
  const partnerWork = useEvents(startMs, endMs, rel ? settings.partnerWorkCalendarIds : [])
  const joint = useEvents(startMs, endMs, rel ? settings.jointCalendarIds : [])

  // Date detection (last/next date, booked-week exclusion) gets its own scan: it
  // spans a year back through the lookahead, and covers the date rule's scoped
  // calendars (e.g. "Us") even when they aren't marked blocking/joint/partner.
  const dateRule = useMemo(
    () => resolveDateRule(settings.metricRules, settings.dateRuleId),
    [settings.metricRules, settings.dateRuleId],
  )
  const dateScanCalendarIds = useMemo(
    () =>
      rel
        ? [
            ...new Set([
              ...(dateRule?.calendarIds ?? []),
              ...settings.blockingCalendarIds,
              ...settings.jointCalendarIds,
              ...settings.partnerBlockingCalendarIds,
            ]),
          ]
        : [],
    [rel, dateRule, settings.blockingCalendarIds, settings.jointCalendarIds, settings.partnerBlockingCalendarIds],
  )
  const pastStartMs = addDays(new Date(startMs), -DATE_LOOKBACK_DAYS).getTime()
  const dateScan = useEvents(pastStartMs, endMs, dateScanCalendarIds)
  const dateMatches = useMemo(
    () => (dateRule ? matchRule(dateScan.events ?? [], dateRule) : []),
    [dateRule, dateScan.events],
  )

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
  const allDayCalendarIds = useMemo(
    () => new Set(settings.allDayBlockingCalendarIds),
    [settings.allDayBlockingCalendarIds],
  )

  // Partner/joint streams run through the same builder as personal events, so
  // rule overrides and the per-calendar all-day policy apply consistently. Lifted
  // to page level so both the relationship overlays and the "top free days" ranking
  // (which can lean toward partner-busy times) share one computation.
  const busyOpts = useMemo(
    () => ({ rules: settings.metricRules, allDay, allDayCalendarIds }),
    [settings.metricRules, allDay, allDayCalendarIds],
  )
  const jointBusy = useMemo(() => buildBusy(joint.events ?? [], busyOpts), [joint.events, busyOpts])
  const partnerBusy = useMemo(
    () => mergeIntervals([...buildBusy(partner.events ?? [], busyOpts), ...jointBusy]),
    [partner.events, busyOpts, jointBusy],
  )
  // nonWorkEvents/workEvents are already rule-overridden (events, above), so
  // convert directly — pass the same all-day policy used everywhere else.
  const nonWorkBusy = useMemo(
    () => eventsToBusy(nonWorkEvents ?? [], { allDay, allDayCalendarIds }),
    [nonWorkEvents, allDay, allDayCalendarIds],
  )
  const workBusy = useMemo(
    () => eventsToBusy(workEvents ?? [], { allDay, allDayCalendarIds }),
    [workEvents, allDay, allDayCalendarIds],
  )

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
      // Lean toward windows the partner is busy (keeps shared-free time open),
      // but only as a soft tiebreaker and only in relationship mode.
      partnerBusy: rel && settings.freeFavorPartnerBusy ? partnerBusy : undefined,
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
    rel,
    settings.freeFavorPartnerBusy,
    partnerBusy,
    startMs,
    nowMs,
    lookahead,
  ])

  // How many of the top picks fall in the displayed month — the "★ Top picks" card count.
  const topPicksCount = useMemo(
    () => days.filter(([d]) => isSameMonth(new Date(d + 'T12:00:00'), selectedMonth)).length,
    [days, selectedMonth],
  )

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
  const combinedBusy = useMemo(
    () => eventsToBusy(events ?? [], { allDay, allDayCalendarIds }),
    [events, allDay, allDayCalendarIds],
  )
  const winKeys = useMemo(() => windowKeys(settings.windows), [settings.windows])

  // Relationship overlays: the partner's non-working days, days with enough
  // mutual free time, and the top date-night candidates. Joint events block both
  // partners, so they fold into each side's busy.
  const relationship = useMemo(() => {
    const empty = {
      notWorkingSet: new Set<string>(),
      overlapSet: new Set<string>(),
      overlapWeekendSet: new Set<string>(),
      overlapWeeknightSet: new Set<string>(),
      bothOffSet: new Set<string>(),
      dateSet: new Set<string>(),
      dateReasons: new Map<string, string[]>(),
      overlapBusy: [] as ReturnType<typeof mergeIntervals>,
      partnerBusy: [] as ReturnType<typeof mergeIntervals>,
    }
    if (!rel) return empty
    const HOUR = 60 * 60 * 1000
    // busyOpts/jointBusy/partnerBusy are lifted to page level (above) so the free-
    // day ranking can share them; partnerWork stays local to this overlay.
    const partnerWorkBusy = buildBusy(partnerWork.events ?? [], busyOpts)
    const myBusy = mergeIntervals([...combinedBusy, ...jointBusy])
    // Count only the displayed month, clamped to the valid horizon (today → lookahead).
    const from = Math.max(startOfMonth(selectedMonth).getTime(), startMs)
    const to = Math.min(endOfMonth(selectedMonth).getTime(), addDays(new Date(startMs), lookahead).getTime())
    const dates = to >= from ? datesInRange(new Date(from), new Date(to)) : []

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
    const bookedWeeks = weeksWithDateEvent(dateMatches)
    const candidates = eligible.filter((d) => !bookedWeeks.has(weekKey(d)))
    const overlapBusy = mergeIntervals([...myBusy, ...partnerBusy])
    const blocked = blockedDates(overlapBusy)
    const dateSet = new Set(
      rankDateCandidates(candidates, overlap, blocked, {
        count: settings.dateCandidateCount,
        isolationWindow: settings.isolationWindowDays,
        preference: settings.datePreference,
        favorPartnerOff: settings.dateFavorPartnerOff,
        partnerOff: notWorkingSet,
        order: settings.dateRankOrder,
      }),
    )

    // Human-readable reasons a day was picked, shown as chips on the detail card.
    const dateReasons = new Map<string, string[]>()
    for (const dstr of dateSet) {
      const reasons: string[] = []
      if (settings.dateFavorPartnerOff && notWorkingSet.has(dstr)) reasons.push(`${partnerName} off`)
      if (isWknd(dstr)) reasons.push('Weekend')
      const hrs = (overlap.get(dstr) ?? 0) / HOUR
      if (hrs > 0) reasons.push(`${Math.round(hrs * 10) / 10}h free together`)
      const iso = dayIsolation(dstr, blocked, settings.isolationWindowDays)
      if (iso > 0) reasons.push(`${iso}+ day${iso === 1 ? '' : 's'} clear`)
      dateReasons.set(dstr, reasons)
    }
    return {
      notWorkingSet,
      overlapSet,
      overlapWeekendSet,
      overlapWeeknightSet,
      bothOffSet,
      dateSet,
      dateReasons,
      overlapBusy,
      partnerBusy,
    }
  }, [
    rel,
    busyOpts,
    jointBusy,
    partnerBusy,
    partnerWork.events,
    combinedBusy,
    workBusy,
    dateMatches,
    settings.windows,
    settings.dayStart,
    settings.overlapMinHours,
    settings.dateMinHours,
    settings.dateCandidateCount,
    settings.isolationWindowDays,
    settings.datePreference,
    settings.dateFavorPartnerOff,
    settings.dateRankOrder,
    partnerName,
    startMs,
    lookahead,
    selectedMonth,
  ])

  // Days the overlap highlight covers = union of whichever subset cards are on.
  // Empty when none are on.
  const overlapHighlight = useMemo(() => {
    if (!rel || !showOverlap) return new Set<string>()
    const out = new Set<string>()
    if (showOverlapWeekends) for (const d of relationship.overlapWeekendSet) out.add(d)
    if (showOverlapWeeknights) for (const d of relationship.overlapWeeknightSet) out.add(d)
    if (showOverlapOffDays) for (const d of relationship.bothOffSet) out.add(d)
    return out
  }, [rel, showOverlap, showOverlapWeekends, showOverlapWeeknights, showOverlapOffDays, relationship])

  const layers = useMemo<OverlayLayer[]>(() => {
    if (!rel) return []
    const out: OverlayLayer[] = []
    if (showNotWorking) out.push({ key: 'not-working', dates: relationship.notWorkingSet, color: getColor(settings, 'relationship.partnerOff'), style: 'tint' })
    if (showOverlap && overlapHighlight.size) out.push({ key: 'overlap', dates: overlapHighlight, color: overlapColor, style: 'ring' })
    if (showDates) out.push({ key: 'dates', dates: relationship.dateSet, color: getColor(settings, 'relationship.dateMarker'), style: 'marker', mark: '❤️' })
    return out
  }, [rel, showNotWorking, showOverlap, showDates, overlapHighlight, relationship, settings, overlapColor])

  // Cadence nudge: how long since the last date and when the next one is, from
  // the dedicated date scan (spans a year back through the lookahead).
  const dateNudge = useMemo(() => {
    if (!rel) return null
    const now = new Date(nowMs)
    const last = lastDateEvent(dateMatches, now)
    const next = nextDateEvent(dateMatches, now)
    const daysSince = last ? differenceInCalendarDays(now, new Date(last + 'T12:00:00')) : null
    const overdue = settings.dateCadenceDays > 0 && (daysSince === null || daysSince > settings.dateCadenceDays)
    return { last, next, overdue }
  }, [rel, nowMs, dateMatches, settings.dateCadenceDays])

  // relativeDayLabel only phrases future dates; add past phrasing for "last date".
  const relDayLabel = useCallback(
    (dateStr: string) => {
      const target = new Date(dateStr + 'T12:00:00')
      const diff = differenceInCalendarDays(target, new Date(nowMs))
      const rel =
        diff >= 0
          ? relativeDayLabel(target, new Date(nowMs))
          : (() => {
              const n = -diff
              if (n < 14) return `${n} day${n === 1 ? '' : 's'} ago`
              if (n < 60) return `${Math.round(n / 7)} weeks ago`
              return `${Math.round(n / 30)} months ago`
            })()
      return `${rel} (${format(target, 'M/d')})`
    },
    [nowMs],
  )

  // Booking: create a tentative date event in a mutual-free window, then refresh
  // the calendars that feed date detection so it shows immediately.
  const planTargetId = settings.dateTargetCalendarId || settings.jointCalendarIds[0] || settings.blockingCalendarIds[0] || ''
  // A successful booking refreshes the calendars (which briefly unmounts the
  // card), so show the confirmation here at the page level where it survives.
  const [bookedMsg, setBookedMsg] = useState<string | null>(null)
  const planDate = useCallback(
    async (start: Date, end: Date) => {
      if (!planTargetId) throw new Error('Pick a target calendar in Settings → Relationship first.')
      const title = settings.dateEventTitle || 'Date'
      await createEvent(planTargetId, {
        summary: title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      })
      setBookedMsg(`Booked "${title}" — ${format(start, 'EEE M/d, h:mm a')}`)
      setNowMs(Date.now())
      await Promise.all([refresh(), joint.refresh(), dateScan.refresh()])
    },
    [planTargetId, settings.dateEventTitle, refresh, joint, dateScan],
  )

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

  // Day-detail card for the selected day (panel on desktop, stacked on mobile).
  const selectedSlots = useMemo(() => (selected ? slotsForDate(selected) : []), [selected, slotsForDate])
  const dayCardEl = selected ? (
    <DayTimelineCard
      key={selected}
      date={selected}
      slots={selectedSlots}
      windows={settings.windows}
      busy={combinedBusy}
      now={new Date(nowMs)}
      dayStart={settings.dayStart}
      windowOrder={winKeys}
      dayInfo={dayInfo}
      slotInfo={slotInfo}
      overlapBusy={showOverlap && overlapHighlight.has(selected) ? relationship.overlapBusy : undefined}
      overlapShadeColor={overlapColor}
      partnerBusy={rel ? relationship.partnerBusy : undefined}
      partnerName={rel ? partnerName : undefined}
      reasons={rel ? relationship.dateReasons.get(selected) : undefined}
      events={settings.dayEventCalendarIds.length ? eventsForDate(selected) : undefined}
      calendarColors={calColors}
      onPlanDate={rel ? planDate : undefined}
      dateMinHours={settings.dateMinHours}
    />
  ) : null

  // Panel stacks the day card below metrics, but only while the selected day is
  // in the viewed month; paging away hides the card without clearing selection.
  const dayInView = !!selected && isSameMonth(new Date(selected + 'T12:00:00'), selectedMonth)

  // Desktop: Escape clears the day selection (panel → metrics). Mobile uses the
  // sheet's own Escape handler, so guard on isDesktop to avoid double-handling.
  useEffect(() => {
    if (!isDesktop || !selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(undefined)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isDesktop, selected])

  const topPicks = {
    count: topPicksCount,
    active: highlightPicks,
    color: getColor(settings, 'metric.default'),
    onToggle: () => setHighlightPicks((v) => !v),
  }
  const nudgeTitle = dateNudge
    ? `Last date: ${dateNudge.last ? relDayLabel(dateNudge.last) : 'none yet'} · Next: ${
        dateNudge.next ? relDayLabel(dateNudge.next) : 'none scheduled'
      }`
    : undefined
  // "Me & {Partner}" relationship cards, shared by the mobile stack and desktop bar.
  const relCards = (bar: boolean) => (
    <RelationshipStats
      bar={bar}
      tinted={bar}
      partnerName={partnerName}
      partnerOff={relationship.notWorkingSet.size}
      overlapTotal={relationship.overlapSet.size}
      overlapWeekends={relationship.overlapWeekendSet.size}
      overlapWeeknights={relationship.overlapWeeknightSet.size}
      bothOff={relationship.bothOffSet.size}
      dateOptions={relationship.dateSet.size}
      partnerOffColor={getColor(settings, 'relationship.partnerOff')}
      overlapColor={overlapColor}
      dateColor={getColor(settings, 'relationship.dateMarker')}
      showNotWorking={showNotWorking}
      showOverlap={showOverlap}
      showOverlapWeekends={showOverlapWeekends}
      showOverlapWeeknights={showOverlapWeeknights}
      showOverlapOffDays={showOverlapOffDays}
      showDates={showDates}
      onToggleNotWorking={() => setShowNotWorking((v) => !v)}
      onToggleOverlap={() => setShowOverlap((v) => !v)}
      onToggleWeekends={() => setShowOverlapWeekends((v) => !v)}
      onToggleWeeknights={() => setShowOverlapWeeknights((v) => !v)}
      onToggleOffDays={() => setShowOverlapOffDays((v) => !v)}
      onToggleDates={() => setShowDates((v) => !v)}
      overdue={!!dateNudge?.overdue}
      nudgeTitle={nudgeTitle}
    />
  )

  return (
    <div className="space-y-4 xl:flex xl:h-[calc(100dvh-4rem)] xl:min-h-0 xl:flex-col xl:gap-4 xl:space-y-0">
      {!isDesktop && <MetricsStats {...metrics} colorFor={colorFor} onColor={setColor} topPicks={topPicks} />}
      {!isDesktop && rel && relCards(false)}
      {bookedMsg && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
          <span>❤️ {bookedMsg}</span>
          <button onClick={() => setBookedMsg(null)} className="shrink-0 text-emerald-700/70 hover:text-emerald-700 dark:text-emerald-300/70" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}
      {!loading && !error && days.length === 0 && (
        <p className="py-8 text-center text-slate-500 dark:text-slate-400">
          No free slots in the next {lookahead} days. Busy life!
        </p>
      )}
      {!loading && !error && days.length > 0 && (() => {
        const calendar = (
          <FreeCalendar
            days={days}
            windows={settings.windows}
            busy={combinedBusy}
            now={new Date(nowMs)}
            maxDate={addDays(new Date(startMs), lookahead)}
            dayStart={settings.dayStart}
            highlightPicks={highlightPicks}
            selected={selected}
            onSelectDay={(d) => setSelected((prev) => (!isDesktop && prev === d ? undefined : d))}
            slotsForDate={slotsForDate}
            overlay={metricOverlay}
            layers={layers}
            overlapBusy={showOverlap ? relationship.overlapBusy : undefined}
            overlapShadeColor={overlapColor}
            overlapShadeDates={overlapHighlight}
            selectedMonth={selectedMonth}
            onSelectMonth={(m) => setSelectedMonth(startOfMonth(m))}
            headerSlot={
              isDesktop ? (
                <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                  <MetricsStats {...metrics} colorFor={colorFor} onColor={setColor} bar tinted topPicks={topPicks} />
                  {rel && relCards(true)}
                </div>
              ) : undefined
            }
          />
        )
        if (!isDesktop) {
          return (
            <>
              {calendar}
              <BottomSheet open={!!selected} onClose={() => setSelected(undefined)}>
                {dayCardEl}
              </BottomSheet>
            </>
          )
        }
        return (
          <>
            <div className="flex items-start gap-4 xl:min-h-0 xl:flex-1 xl:items-stretch">
              <div className="min-w-0 flex-1 xl:h-full">{calendar}</div>
              <aside className="w-96 shrink-0">
                <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto px-1">
                  {dayInView ? (
                    dayCardEl
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                      Pick a day to see its free time.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </>
        )
      })()}
    </div>
  )
}
