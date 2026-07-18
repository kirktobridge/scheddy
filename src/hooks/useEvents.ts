import { useCallback, useEffect, useState } from 'react'
import { getCachedEventsMulti, listEventsMulti, type GEvent } from '../api/calendar'
import { useSettings } from '../store/settings'

interface EventsState {
  events: GEvent[] | null
  loading: boolean
  error: string | null
  /** Served from cache and past the soft TTL — a fresh fetch is in flight. */
  stale: boolean
}

/** Initial/served state from the synchronous cache (or the empty/idle states). */
function fromCache(calendarKey: string, required: boolean, startMs: number, endMs: number): EventsState {
  if (!calendarKey) {
    return required
      ? { events: null, loading: false, error: 'Pick your calendars in Settings first.', stale: false }
      : { events: [], loading: false, error: null, stale: false }
  }
  const cached = getCachedEventsMulti(calendarKey.split(','), new Date(startMs), new Date(endMs))
  if (cached) return { events: cached.events, loading: false, error: null, stale: cached.stale }
  return { events: null, loading: true, error: null, stale: false }
}

/**
 * Fetches events for [startMs, endMs] from `calendarIds`, defaulting to the
 * blocking calendars from settings (in which case an empty selection is an
 * error; an explicitly passed empty list just yields no events).
 * Pass timestamps (not Dates) so the dependency check is by value.
 *
 * Stale-while-revalidate (B-01): a warm cache paints instantly on mount, then a
 * background refetch swaps in fresh data. `refresh()` always bypasses the cache
 * (manual Refresh / post-booking) and resolves when the fetch settles.
 */
export function useEvents(startMs: number, endMs: number, calendarIds?: string[]) {
  const [settings] = useSettings()
  const required = calendarIds === undefined
  const calendarKey = (calendarIds ?? settings.blockingCalendarIds).join(',')
  const [state, setState] = useState<EventsState>(() => fromCache(calendarKey, required, startMs, endMs))

  const load = useCallback(
    async (bypassCache: boolean) => {
      if (!calendarKey) {
        setState(fromCache(calendarKey, required, startMs, endMs))
        return
      }
      const ids = calendarKey.split(',')
      const timeMin = new Date(startMs)
      const timeMax = new Date(endMs)
      if (!bypassCache) {
        const cached = getCachedEventsMulti(ids, timeMin, timeMax)
        if (cached) {
          setState({ events: cached.events, loading: false, error: null, stale: cached.stale })
          if (!cached.stale) return // fresh enough — no revalidate needed
        } else {
          // Only spin when there's nothing to show; keep any existing data visible.
          setState((s) => ({ ...s, loading: s.events === null, error: null }))
        }
      } else {
        setState((s) => ({ ...s, loading: s.events === null, error: null }))
      }
      try {
        const events = await listEventsMulti(ids, timeMin, timeMax)
        setState({ events, loading: false, error: null, stale: false })
      } catch (err) {
        setState({ events: null, loading: false, error: err instanceof Error ? err.message : String(err), stale: false })
      }
    },
    [calendarKey, required, startMs, endMs],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const refresh = useCallback(() => load(true), [load])

  return { ...state, refresh }
}
