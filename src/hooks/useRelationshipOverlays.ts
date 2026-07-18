import { useMemo } from 'react'
import { addDays, endOfMonth, isWeekend, startOfMonth } from 'date-fns'
import { blockedDates, dayIsolation, mergeIntervals } from '../lib/availability'
import { buildBusy } from '../lib/metrics'
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
import type { GEvent } from '../api/calendar'
import { useSettings } from '../store/settings'
import type { BusyStreams } from './useBusy'

/** Busy streams the overlays consume (a subset of useBusy's output). */
type OverlayBusy = Pick<BusyStreams, 'busyOpts' | 'jointBusy' | 'partnerBusy' | 'combinedBusy' | 'workBusy'>

/**
 * Relationship overlays for the Free view: the partner's non-working days, days
 * with enough mutual free time (and its weekend / weeknight / both-off subsets),
 * and the top date-night candidates with human-readable reasons. Joint events
 * block both partners, so they fold into each side's busy.
 *
 * Returns empty sets when relationship mode is off. Extracted verbatim from
 * FreePage (B-09).
 */
export function useRelationshipOverlays(
  busy: OverlayBusy,
  partnerWorkEvents: GEvent[] | null,
  dateMatches: GEvent[],
  range: { startMs: number; lookahead: number; selectedMonth: Date },
) {
  const [settings] = useSettings()
  const rel = settings.relationshipMode
  const partnerName = settings.partnerName || 'Partner'
  const { busyOpts, jointBusy, partnerBusy, combinedBusy, workBusy } = busy
  const { startMs, lookahead, selectedMonth } = range

  return useMemo(() => {
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
    // busyOpts/jointBusy/partnerBusy are lifted to useBusy so the free-day
    // ranking can share them; partnerWork stays local to this overlay.
    const partnerWorkBusy = buildBusy(partnerWorkEvents ?? [], busyOpts)
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
    partnerWorkEvents,
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
}
