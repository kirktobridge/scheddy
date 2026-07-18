import { useMemo } from 'react'
import { eventsToBusy, mergeIntervals, type BusyInterval } from '../lib/availability'
import { buildBusy, type BusyOpts } from '../lib/metrics'
import type { GEvent } from '../api/calendar'
import { useSettings } from '../store/settings'

export interface BusyStreams {
  /** Shared builder options (rules + all-day policy); reused by the overlays. */
  busyOpts: BusyOpts
  workBusy: BusyInterval[]
  nonWorkBusy: BusyInterval[]
  combinedBusy: BusyInterval[]
  jointBusy: BusyInterval[]
  partnerBusy: BusyInterval[]
  /** Personal non-work events (rule-overridden) — for slot booking labels. */
  nonWorkEvents: GEvent[]
}

/**
 * Turns the raw event streams into the busy-interval sets the Free view runs its
 * availability math on. `events` is expected to already carry keyword-rule
 * overrides (see applyRuleOverrides); partner/joint streams run through the same
 * `buildBusy` path so the "does it block?" decision can't drift between them.
 *
 * Partner/joint busy are lifted here (rather than kept inside the relationship
 * overlays) so the "top free days" ranking — which can lean toward partner-busy
 * times — shares one computation. Extracted verbatim from FreePage (B-09).
 */
export function useBusy(
  events: GEvent[] | null,
  partnerEvents: GEvent[] | null,
  jointEvents: GEvent[] | null,
): BusyStreams {
  const [settings] = useSettings()

  // Work events don't count toward "partly booked" — they get a "free after
  // work" label instead. Split them out before computing availability.
  const workIds = settings.workCalendarIds
  const { workEvents, nonWorkEvents } = useMemo(() => {
    const work = new Set(workIds)
    const workEvents: GEvent[] = []
    const nonWorkEvents: GEvent[] = []
    for (const ev of events ?? []) (ev.calendarId && work.has(ev.calendarId) ? workEvents : nonWorkEvents).push(ev)
    return { workEvents, nonWorkEvents }
  }, [events, workIds])

  const allDay = settings.blockAllDayEvents
  const allDayCalendarIds = useMemo(
    () => new Set(settings.allDayBlockingCalendarIds),
    [settings.allDayBlockingCalendarIds],
  )

  // Partner/joint streams run through the same builder as personal events, so
  // rule overrides and the per-calendar all-day policy apply consistently.
  const busyOpts = useMemo(
    () => ({ rules: settings.metricRules, allDay, allDayCalendarIds }),
    [settings.metricRules, allDay, allDayCalendarIds],
  )
  const jointBusy = useMemo(() => buildBusy(jointEvents ?? [], busyOpts), [jointEvents, busyOpts])
  const partnerBusy = useMemo(
    () => mergeIntervals([...buildBusy(partnerEvents ?? [], busyOpts), ...jointBusy]),
    [partnerEvents, busyOpts, jointBusy],
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
  // Combined busy (work counts as busy) drives the availability bars.
  const combinedBusy = useMemo(
    () => eventsToBusy(events ?? [], { allDay, allDayCalendarIds }),
    [events, allDay, allDayCalendarIds],
  )

  return { busyOpts, workBusy, nonWorkBusy, combinedBusy, jointBusy, partnerBusy, nonWorkEvents }
}
