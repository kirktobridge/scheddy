import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, differenceInCalendarDays, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, getDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { blockedDates, findFreeSlots, freeHours, rankFreeDays, windowKeys, type Slot } from '../lib/availability'
import { applyRuleOverrides, matchRule } from '../lib/metrics'
import { datesInRange, lastDateEvent, nextDateEvent, resolveDateRule } from '../lib/relationship'
import type { OverlayLayer } from '../components/FreeCalendar'
import { adjustForWork, holidayNote, nextDayWarning, relativeDayLabel, slotBookings } from '../lib/annotate'
import { useSettings } from '../store/settings'
import { getColor } from '../lib/designTokens'
import { mixColors } from '../lib/colorMix'
import { createEvent } from '../api/calendar'
import { useEvents } from '../hooks/useEvents'
import { useReauth } from '../hooks/useReauth'
import { useBusy } from '../hooks/useBusy'
import { useRelationshipOverlays } from '../hooks/useRelationshipOverlays'
import { useQueryMode } from '../hooks/useQueryMode'
import { useHorizon } from '../hooks/useHorizon'
import { useNow } from '../hooks/useNow'
import { useCalendars } from '../hooks/useCalendars'
import { eventsForDay } from '../lib/format'
import { type DayInfo, type SlotInfo } from '../components/SlotList'
import FreeCalendar from '../components/FreeCalendar'
import QueryModeBar from '../components/QueryModeBar'
import QueryResults from '../components/QueryResults'
import NextActions, { type PickAction } from '../components/NextActions'
import DayTimelineCard from '../components/DayTimelineCard'
import BottomSheet from '../components/BottomSheet'
import { ErrorBanner, Spinner } from '../components/Banner'
import MetricsStats from '../components/MetricsStats'
import RelationshipStats from '../components/RelationshipStats'
import LayersLegend, { type LegendItem } from '../components/LayersLegend'
import DefenseRail, { type DefenseRow } from '../components/DefenseRail'
import { useMetrics } from '../hooks/useMetrics'
import { useMediaQuery } from '../hooks/useMediaQuery'

/** How far back to scan for the most recent past date (cadence nudge). */
const DATE_LOOKBACK_DAYS = 365

export default function FreePage({
  refreshTick = 0,
  onStatus,
}: {
  refreshTick?: number
  /** Reports load/staleness up to the shell's corner refresh control (B-27). */
  onStatus?: (status: { loading: boolean; stale: boolean }) => void
}) {
  const [settings] = useSettings()
  /** Shared accent for the "Our Overlap" + "Date Options" controls and overlap bar shading. */
  const overlapColor = getColor(settings, 'relationship.overlap')
  const partnerOffColor = getColor(settings, 'relationship.partnerOff')
  const dateColor = getColor(settings, 'relationship.dateMarker')
  const colorFor = (key: string) => settings.metricColors[key] ?? getColor(settings, 'metric.default')
  // "now" re-reads itself (visibility/interval) so a long-open PWA doesn't show
  // stale slots; bumpNow forces it (Refresh, post-booking).
  const [nowMs, bumpNow] = useNow()
  const [highlightPicks, setHighlightPicks] = useState(true)
  const [showWeekPicks, setShowWeekPicks] = useState(false)
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
  // Desktop-first: the !isDesktop branches below are the deprecated/frozen mobile
  // layout. Remove them only when one blocks a desktop change. See CLAUDE.md
  // "Platform scope (desktop-first)".
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  // Free view horizon: clamp(minHorizonDays, last horizon-calendar event, maxHorizonDays).
  const { lookahead } = useHorizon(nowMs)
  const startMs = startOfDay(new Date(nowMs)).getTime()
  // Fetch one day past the lookahead so next-day warnings work on the last slot,
  // plus the isolation window so forward spacing is accurate at the end of the span.
  const endMs = addDays(new Date(startMs), lookahead + settings.isolationWindowDays + 1).getTime()
  // Last selectable/queryable day on the canvas (the visible horizon).
  const maxDateMs = addDays(new Date(startMs), lookahead).getTime()
  // Query layer (B-24): a lens over this canvas — replaced the standalone Check page.
  const query = useQueryMode(nowMs, maxDateMs, settings.windows)

  const { events: rawEvents, loading, error, stale, authRequired, refresh } = useEvents(startMs, endMs)
  const handleSignIn = useReauth(refresh)
  useEffect(() => {
    onStatus?.({ loading, stale })
  }, [loading, stale, onStatus])
  // The Refresh control lives in the corner controls (App); it bumps refreshTick. Re-fetch and
  // reset "now" when it changes, skipping the initial mount (data already loads then).
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    bumpNow()
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

  // Busy-interval sets for the availability math: personal work/non-work/combined
  // plus the partner and joint streams (lifted here so the "top free days" ranking
  // and the relationship overlays share one computation). See useBusy.
  const { busyOpts, workBusy, nonWorkBusy, combinedBusy, jointBusy, partnerBusy, nonWorkEvents } = useBusy(
    events,
    partner.events,
    joint.events,
  )

  // All days in the lookahead with a slot meeting the threshold, keyed by date —
  // the candidate pool the rankings below draw from. Independent of the selected
  // day so picking a day doesn't re-run findFreeSlots.
  const byDate = useMemo<Map<string, Slot[]>>(() => {
    const map = new Map<string, Slot[]>()
    if (!events) return map
    const found = findFreeSlots(nonWorkBusy, settings.windows, new Date(startMs), addDays(new Date(startMs), lookahead), {
      threshold: settings.freeThreshold,
      now: new Date(nowMs),
    })
    for (const slot of found) {
      const a = adjustForWork(slot, workBusy)
      if (!a) continue
      const list = map.get(a.date) ?? []
      list.push(a)
      map.set(a.date, list)
    }
    return map
  }, [events, nonWorkBusy, workBusy, settings.windows, settings.freeThreshold, startMs, nowMs, lookahead])

  // Dates with any blocking event — drives the isolation scoring in rankFreeDays.
  const blocked = useMemo(() => blockedDates(nonWorkBusy), [nonWorkBusy])

  // Ranking factors shared by the month picks and the week drill-down: prefer
  // isolation, then most free time, then weekends. The partner-busy soft
  // tiebreaker only applies in relationship mode.
  const rankOpts = useMemo(
    () => ({
      isolationWindow: settings.isolationWindowDays,
      favorWeekends: settings.favorWeekends,
      // Lean toward windows the partner is busy (keeps shared-free time open),
      // but only as a soft tiebreaker and only in relationship mode.
      partnerBusy: rel && settings.freeFavorPartnerBusy ? partnerBusy : undefined,
    }),
    [settings.isolationWindowDays, settings.favorWeekends, rel, settings.freeFavorPartnerBusy, partnerBusy],
  )

  // The "top N" picks across the lookahead, ordered by date (see rankFreeDays).
  const days = useMemo<[string, Slot[]][]>(
    () => rankFreeDays([...byDate.entries()], blocked, { count: settings.freeSlotCount, ...rankOpts }),
    [byDate, blocked, settings.freeSlotCount, rankOpts],
  )

  // The "top N₂" picks for the focused week — the week of the selected day, else
  // the week containing today. A fresh ranking scoped to that week, capped at N₂.
  const weekPicks = useMemo<Set<string>>(() => {
    const anchor = new Date((selected ?? format(new Date(nowMs), 'yyyy-MM-dd')) + 'T12:00:00')
    const from = startOfWeek(anchor)
    const to = endOfWeek(anchor)
    const inWeek = [...byDate.entries()].filter(([d]) => {
      const day = new Date(d + 'T12:00:00')
      return day >= from && day <= to
    })
    const ranked = rankFreeDays(inWeek, blocked, { count: settings.freeSlotCountWeek, ...rankOpts })
    return new Set(ranked.map(([d]) => d))
  }, [byDate, blocked, selected, nowMs, settings.freeSlotCountWeek, rankOpts])

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

  const winKeys = useMemo(() => windowKeys(settings.windows), [settings.windows])

  // Relationship overlays: the partner's non-working days, days with enough
  // mutual free time, and the top date-night candidates. Joint events block both
  // partners, so they fold into each side's busy. See useRelationshipOverlays.
  const relationship = useRelationshipOverlays(
    { busyOpts, jointBusy, partnerBusy, combinedBusy, workBusy },
    partnerWork.events,
    dateMatches,
    { startMs, lookahead, selectedMonth },
  )

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
    const out: OverlayLayer[] = []
    // The week-pick ring works in solo and relationship mode alike.
    if (showWeekPicks && weekPicks.size)
      out.push({ key: 'week-picks', dates: weekPicks, color: getColor(settings, 'metric.default'), style: 'ring' })
    if (!rel) return out
    if (showNotWorking) out.push({ key: 'not-working', dates: relationship.notWorkingSet, color: getColor(settings, 'relationship.partnerOff'), style: 'tint' })
    if (showOverlap && overlapHighlight.size) out.push({ key: 'overlap', dates: overlapHighlight, color: overlapColor, style: 'ring' })
    if (showDates) out.push({ key: 'dates', dates: relationship.dateSet, color: getColor(settings, 'relationship.dateMarker'), style: 'marker', mark: '❤️' })
    return out
  }, [rel, showNotWorking, showOverlap, showDates, showWeekPicks, weekPicks, overlapHighlight, relationship, settings, overlapColor])

  // Query layer (B-24): free slots matching the active query range, filtered to
  // its windows. "Both of us" runs the search against the mutual busy (partner +
  // joint folded in) already computed by the relationship overlays; the solo path
  // mirrors the canvas's own work-adjusted slots.
  const querySlots = useMemo<Slot[]>(() => {
    if (!query.range || !events) return []
    const [qs, qe] = query.range
    const mutual = query.bothOfUs && rel
    const found = findFreeSlots(mutual ? relationship.overlapBusy : nonWorkBusy, settings.windows, qs, qe, {
      threshold: settings.freeThreshold,
      now: new Date(nowMs),
      windowFilter: query.windowFilter,
    })
    if (mutual) return found
    const out: Slot[] = []
    for (const s of found) {
      const a = adjustForWork(s, workBusy)
      if (a) out.push(a)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.range, query.bothOfUs, query.windowFilter, rel, events, nonWorkBusy, relationship.overlapBusy, workBusy, settings.windows, settings.freeThreshold, nowMs])

  // One-line range busyness read off the query results (VISION: defensive framing).
  const querySummary = useMemo(() => {
    if (!query.range) return ''
    const [qs, qe] = query.range
    const total = datesInRange(startOfDay(qs), qe).length
    const freeDays = new Set(querySlots.map((s) => s.date)).size
    const taken = total - freeDays
    const together = query.bothOfUs && rel ? 'together ' : ''
    const days = `${total} day${total === 1 ? '' : 's'}`
    if (freeDays === 0) return `All ${days} booked in this range.`
    if (taken === 0) return `Free time ${together}on all ${days}.`
    return `${taken} of ${days} already booked.`
  }, [query.range, query.bothOfUs, rel, querySlots])

  // The metric/relationship layers plus, in query mode, a ring on days that have a
  // matching free slot — so the answer is visible on the canvas, not just the rail.
  const canvasLayers = useMemo<OverlayLayer[]>(() => {
    if (!query.active || querySlots.length === 0) return layers
    const dates = new Set(querySlots.map((s) => s.date))
    return [...layers, { key: 'query', dates, color: getColor(settings, 'metric.default'), style: 'ring' }]
  }, [layers, query.active, querySlots, settings])

  // Cadence nudge: how long since the last date and when the next one is, from
  // the dedicated date scan (spans a year back through the lookahead).
  const dateNudge = useMemo(() => {
    if (!rel) return null
    const now = new Date(nowMs)
    const last = lastDateEvent(dateMatches, now)
    const next = nextDateEvent(dateMatches, now)
    const daysSince = last ? differenceInCalendarDays(now, new Date(last + 'T12:00:00')) : null
    const overdue = settings.dateCadenceDays > 0 && (daysSince === null || daysSince > settings.dateCadenceDays)
    // Days until the cadence target is due (null when no cadence set or already overdue).
    const dueIn =
      settings.dateCadenceDays > 0 && daysSince !== null && !overdue ? settings.dateCadenceDays - daysSince : null
    return { last, next, overdue, daysSince, dueIn }
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
      bumpNow()
      await Promise.all([refresh(), joint.refresh(), dateScan.refresh()])
    },
    [planTargetId, settings.dateEventTitle, refresh, joint, dateScan, bumpNow],
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

  // The day card stays pinned to the selected day while paging through months;
  // it only changes when another day is picked (or Escape clears the selection).
  const dayInView = !!selected

  // Desktop: Escape clears an active query first, else the day selection (panel →
  // metrics). Mobile uses the sheet's own Escape handler, so guard on isDesktop.
  useEffect(() => {
    if (!isDesktop || (!selected && !query.active)) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (query.active) query.clear()
      else setSelected(undefined)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isDesktop, selected, query.active, query.clear])

  const topPicks = {
    count: topPicksCount,
    active: highlightPicks,
    color: getColor(settings, 'metric.default'),
    onToggle: () => setHighlightPicks((v) => !v),
    weekPicks: {
      count: weekPicks.size,
      n: settings.freeSlotCountWeek,
      active: showWeekPicks,
      color: getColor(settings, 'metric.default'),
      onToggle: () => setShowWeekPicks((v) => !v),
    },
  }
  const nudgeTitle = dateNudge
    ? `Last date: ${dateNudge.last ? relDayLabel(dateNudge.last) : 'none yet'} · Next: ${
        dateNudge.next ? relDayLabel(dateNudge.next) : 'none scheduled'
      }`
    : undefined

  // Soonest upcoming date-option day — the target the "Plan" verb jumps to.
  const nextDateOption = useMemo(() => {
    const today = format(new Date(nowMs), 'yyyy-MM-dd')
    return [...relationship.dateSet].filter((d) => d >= today).sort()[0]
  }, [relationship.dateSet, nowMs])

  // Idle left rail (B-26): the soonest top picks as one-tap rows. `days` is
  // already the ranked pick list ordered by date; keep the nearest few and tag
  // each with its free hours. Every entry is a top month pick, so all star.
  const nextPicks = useMemo<PickAction[]>(
    () =>
      days.slice(0, 4).map(([date, slots]) => ({
        date,
        label: relativeDayLabel(new Date(date + 'T12:00:00'), new Date(nowMs)),
        hours: freeHours(slots),
      })),
    [days, nowMs],
  )

  // Right-rail "Layers" legend — the overlay toggles lifted off the stat cards.
  // Configures which highlights the canvas carries; status/actions live below it.
  const legendItems = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = [
      {
        key: 'picks',
        label: '★ Top picks',
        count: topPicksCount,
        active: highlightPicks,
        onToggle: () => setHighlightPicks((v) => !v),
        children: [
          {
            key: 'week-picks',
            label: `★ Top ${settings.freeSlotCountWeek} this week`,
            count: weekPicks.size,
            active: showWeekPicks,
            onToggle: () => setShowWeekPicks((v) => !v),
          },
        ],
      },
      {
        key: 'evenings',
        label: 'unbooked evenings',
        count: metrics.eveningDates.length,
        color: colorFor('evenings'),
        active: metrics.activeKeys.has('evenings'),
        onToggle: () => metrics.toggle('evenings'),
      },
      {
        key: 'weekend',
        label: 'free weekend days',
        count: metrics.weekendDates.length,
        color: colorFor('weekend'),
        active: metrics.activeKeys.has('weekend'),
        onToggle: () => metrics.toggle('weekend'),
      },
      ...metrics.ruleResults.map(({ rule, matched }) => ({
        key: `rule:${rule.id}`,
        label: `${rule.icon} ${rule.name}`,
        count: matched.length,
        color: colorFor(`rule:${rule.id}`),
        active: metrics.activeKeys.has(`rule:${rule.id}`),
        onToggle: () => metrics.toggle(`rule:${rule.id}`),
      })),
    ]
    if (rel) {
      items.push(
        {
          key: 'partner-off',
          label: `${partnerName} off work`,
          count: relationship.notWorkingSet.size,
          color: partnerOffColor,
          active: showNotWorking,
          onToggle: () => setShowNotWorking((v) => !v),
        },
        {
          key: 'overlap',
          label: '⇄ Our Overlap',
          count: relationship.overlapSet.size,
          color: overlapColor,
          active: showOverlap,
          onToggle: () => setShowOverlap((v) => !v),
          children: [
            { key: 'ov-weekends', label: 'Weekends', count: relationship.overlapWeekendSet.size, color: overlapColor, active: showOverlapWeekends, onToggle: () => setShowOverlapWeekends((v) => !v) },
            { key: 'ov-weeknights', label: 'Weeknights', count: relationship.overlapWeeknightSet.size, color: overlapColor, active: showOverlapWeeknights, onToggle: () => setShowOverlapWeeknights((v) => !v) },
            { key: 'ov-bothoff', label: 'Both off', count: relationship.bothOffSet.size, color: overlapColor, active: showOverlapOffDays, onToggle: () => setShowOverlapOffDays((v) => !v) },
          ],
        },
        {
          key: 'dates',
          label: '❤️ Date Options',
          count: relationship.dateSet.size,
          color: dateColor,
          active: showDates,
          onToggle: () => setShowDates((v) => !v),
        },
      )
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    topPicksCount, highlightPicks, weekPicks.size, showWeekPicks, metrics, settings.metricColors, settings.freeSlotCountWeek,
    rel, partnerName, relationship, partnerOffColor, overlapColor, dateColor,
    showNotWorking, showOverlap, showOverlapWeekends, showOverlapWeeknights, showOverlapOffDays, showDates,
  ])

  // Denominators for the ambient scarcity meters: how many weekend days / total
  // days remain in the viewed month (from today when it's the current month).
  const monthTotals = useMemo(() => {
    const from = metrics.isCurrent ? startOfDay(new Date(nowMs)) : startOfMonth(selectedMonth)
    const to = endOfMonth(selectedMonth)
    if (to < from) return { days: 0, weekendDays: 0 }
    const all = eachDayOfInterval({ start: from, end: to })
    return { days: all.length, weekendDays: all.filter((d) => getDay(d) === 0 || getDay(d) === 6).length }
  }, [metrics.isCurrent, selectedMonth, nowMs])

  // Right-rail "Defense" column — number-led status, phrased defensively, each with
  // an ambient meter and a contextual verb. The date cadence is a first-class row.
  const defenseRows = useMemo<DefenseRow[]>(() => {
    const month = format(selectedMonth, 'MMMM')
    const scope = metrics.isCurrent ? `left in ${month}` : `in ${month}`
    const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
    const rows: DefenseRow[] = []
    // Zero free days across the whole horizon: the map matters most here, so the
    // canvas stays put and the rail leads with a red alert instead (B-26).
    if (days.length === 0) {
      rows.push({
        key: 'no-free',
        value: 0,
        label: 'free days ahead',
        detail: `nothing open in the next ${lookahead} days`,
        accent: '#f43f5e',
        meter: { value: 1, max: 1, warn: true },
      })
    }
    rows.push(
      {
        key: 'weekend',
        value: metrics.weekendDates.length,
        label: `free weekend ${plural(metrics.weekendDates.length, 'day', 'days')}`,
        detail: scope,
        accent: colorFor('weekend'),
        meter: { value: metrics.weekendDates.length, max: monthTotals.weekendDays },
        action: {
          label: metrics.activeKeys.has('weekend') ? 'Hide' : 'Show',
          active: metrics.activeKeys.has('weekend'),
          onClick: () => metrics.toggle('weekend'),
        },
      },
      {
        key: 'evenings',
        value: metrics.eveningDates.length,
        label: `unbooked ${plural(metrics.eveningDates.length, 'evening', 'evenings')}`,
        detail: scope,
        accent: colorFor('evenings'),
        meter: { value: metrics.eveningDates.length, max: monthTotals.days },
        action: {
          label: metrics.activeKeys.has('evenings') ? 'Hide' : 'Show',
          active: metrics.activeKeys.has('evenings'),
          onClick: () => metrics.toggle('evenings'),
        },
      },
    )
    if (rel) {
      rows.push({
        key: 'overlap',
        value: relationship.overlapSet.size,
        label: `${plural(relationship.overlapSet.size, 'day', 'days')} free together`,
        detail: 'ahead',
        accent: overlapColor,
        action: {
          label: showOverlap ? 'Hide' : 'Show',
          active: showOverlap,
          onClick: () => setShowOverlap((v) => !v),
        },
      })
      if (dateNudge) {
        const lastLabel = dateNudge.last ? relDayLabel(dateNudge.last) : 'no date logged yet'
        // Hero number = days until due, or days overdue; the row leads with urgency.
        const overdueBy =
          dateNudge.overdue && dateNudge.daysSince !== null ? dateNudge.daysSince - settings.dateCadenceDays : null
        const dateAction = {
          label: 'Plan',
          disabled: !nextDateOption,
          onClick: () => {
            if (!nextDateOption) return
            if (query.active) query.clear()
            setSelected(nextDateOption)
          },
        }
        rows.push(
          overdueBy !== null
            ? {
                key: 'date-rhythm',
                value: overdueBy,
                label: `${plural(overdueBy, 'day', 'days')} overdue for a date`,
                detail: `last ${lastLabel}`,
                accent: dateColor,
                meter: { value: 1, max: 1, warn: true },
                action: dateAction,
              }
            : {
                key: 'date-rhythm',
                value: dateNudge.dueIn ?? '—',
                label: dateNudge.dueIn !== null ? `${plural(dateNudge.dueIn, 'day', 'days')} to next date` : 'date cadence',
                detail: `last ${lastLabel}`,
                accent: dateColor,
                meter:
                  dateNudge.dueIn !== null && settings.dateCadenceDays > 0
                    ? { value: settings.dateCadenceDays - dateNudge.dueIn, max: settings.dateCadenceDays }
                    : undefined,
                action: dateAction,
              },
        )
      }
    }
    return rows
  }, [
    days.length, lookahead, selectedMonth, metrics, monthTotals, rel, relationship.overlapSet.size, showOverlap, dateNudge,
    settings.dateCadenceDays, relDayLabel, nextDateOption, query, colorFor, overlapColor, dateColor,
  ])
  // "Me & {Partner}" relationship cards — the deprecated/frozen mobile stack only;
  // desktop reads the same state through the LayersLegend + DefenseRail instead.
  const relCardsMobile = (
    <RelationshipStats
      partnerName={partnerName}
      partnerOff={relationship.notWorkingSet.size}
      overlapTotal={relationship.overlapSet.size}
      overlapWeekends={relationship.overlapWeekendSet.size}
      overlapWeeknights={relationship.overlapWeeknightSet.size}
      bothOff={relationship.bothOffSet.size}
      dateOptions={relationship.dateSet.size}
      partnerOffColor={partnerOffColor}
      overlapColor={overlapColor}
      dateColor={dateColor}
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
    <div className="space-y-4 xl:flex xl:h-[calc(100dvh-4.5rem)] xl:min-h-0 xl:flex-col xl:gap-4 xl:space-y-0">
      {!isDesktop && <MetricsStats {...metrics} colorFor={colorFor} topPicks={topPicks} />}
      {!isDesktop && rel && relCardsMobile}
      {bookedMsg && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
          <span>❤️ {bookedMsg}</span>
          <button onClick={() => setBookedMsg(null)} className="shrink-0 text-emerald-700/70 hover:text-emerald-700 dark:text-emerald-300/70" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {error && <ErrorBanner message={error} onSignIn={authRequired ? handleSignIn : undefined} />}
      {loading && <Spinner />}
      {/* Mobile (frozen) keeps the terse zero-free fallback; desktop always
          renders the canvas and reframes zero-free as a defense alert (B-26). */}
      {!isDesktop && !loading && !error && days.length === 0 && (
        <p className="py-8 text-center text-slate-500 dark:text-slate-400">
          No free slots in the next {lookahead} days. Busy life!
        </p>
      )}
      {!loading && !error && (isDesktop || days.length > 0) && (() => {
        const calendar = (
          <FreeCalendar
            days={days}
            windows={settings.windows}
            busy={combinedBusy}
            now={new Date(nowMs)}
            maxDate={new Date(maxDateMs)}
            dayStart={settings.dayStart}
            highlightPicks={highlightPicks}
            selected={selected}
            onSelectDay={(d) => setSelected((prev) => (!isDesktop && prev === d ? undefined : d))}
            slotsForDate={slotsForDate}
            overlay={metricOverlay}
            layers={canvasLayers}
            overlapBusy={showOverlap ? relationship.overlapBusy : undefined}
            overlapShadeColor={overlapColor}
            overlapShadeDates={overlapHighlight}
            selectedMonth={selectedMonth}
            onSelectMonth={(m) => setSelectedMonth(startOfMonth(m))}
            headerSlot={isDesktop ? <QueryModeBar query={query} winKeys={winKeys} rel={rel} /> : undefined}
            queryRange={query.range ? { start: query.range[0].getTime(), end: query.range[1].getTime() } : null}
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
              <aside className="w-96 shrink-0">
                <div className="sticky top-0 max-h-full overflow-y-auto px-1">
                  {query.active && query.range ? (
                    <QueryResults
                      range={query.range}
                      slots={querySlots}
                      summary={querySummary}
                      windowOrder={winKeys}
                      bothOfUs={query.bothOfUs && rel}
                      dayInfo={dayInfo}
                      slotInfo={query.bothOfUs && rel ? undefined : slotInfo}
                      onClear={query.clear}
                    />
                  ) : dayInView ? (
                    dayCardEl
                  ) : (
                    <NextActions
                      picks={nextPicks}
                      ritual={
                        dateNudge?.overdue
                          ? {
                              text:
                                dateNudge.daysSince !== null && dateNudge.daysSince - settings.dateCadenceDays > 0
                                  ? `${dateNudge.daysSince - settings.dateCadenceDays} days overdue for a date`
                                  : 'Time to plan a date',
                              detail: dateNudge.last ? `last date ${relDayLabel(dateNudge.last)}` : 'no date logged yet',
                              disabled: !nextDateOption,
                            }
                          : undefined
                      }
                      onPick={setSelected}
                      onRitual={() => {
                        if (nextDateOption) setSelected(nextDateOption)
                      }}
                    />
                  )}
                </div>
              </aside>
              <div className="min-w-0 flex-1 xl:h-full">{calendar}</div>
              <aside className="w-72 shrink-0">
                <div className="sticky top-0 max-h-full space-y-6 overflow-y-auto px-1">
                  <DefenseRail rows={defenseRows} />
                  <LayersLegend items={legendItems} />
                </div>
              </aside>
            </div>
          </>
        )
      })()}
    </div>
  )
}
