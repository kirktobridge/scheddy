import { useMemo } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { lastEventDate, resolveHorizonDays } from '../lib/availability'
import { useSettings } from '../store/settings'
import { useEvents } from './useEvents'

/**
 * Resolves how many days ahead the Free view spans: clamp(min, anchor, max),
 * where the anchor is the latest event on the user's horizon calendars.
 *
 * Events are fetched out to the ceiling so an anchor beyond today's floor can be
 * discovered. While the fetch is in flight (events === null) the anchor is null,
 * so the horizon starts at the floor and expands once the fetch resolves — it
 * never shows days that aren't backed by loaded data.
 */
export function useHorizon(nowMs: number): { lookahead: number; anchor: Date | null; loading: boolean } {
  const [settings] = useSettings()
  const startMs = startOfDay(new Date(nowMs)).getTime()
  // Fetch to the ceiling (+ the same isolation/next-day buffer the Free view
  // uses) so a far-out anchor is visible before we clamp.
  const endMs = addDays(new Date(startMs), settings.maxHorizonDays + settings.isolationWindowDays + 1).getTime()
  const { events, loading } = useEvents(startMs, endMs, settings.horizonCalendarIds)

  return useMemo(() => {
    const anchor = events ? lastEventDate(events) : null
    const lookahead = resolveHorizonDays(
      anchor,
      new Date(startMs),
      settings.minHorizonDays,
      settings.maxHorizonDays,
    )
    return { lookahead, anchor, loading }
  }, [events, loading, startMs, settings.minHorizonDays, settings.maxHorizonDays])
}
