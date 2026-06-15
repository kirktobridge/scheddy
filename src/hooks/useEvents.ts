import { useCallback, useEffect, useState } from 'react'
import { listEventsMulti, type GEvent } from '../api/calendar'
import { useSettings } from '../store/settings'

interface EventsState {
  events: GEvent[] | null
  loading: boolean
  error: string | null
}

/**
 * Fetches events for [startMs, endMs] from `calendarIds`, defaulting to the
 * blocking calendars from settings (in which case an empty selection is an
 * error; an explicitly passed empty list just yields no events).
 * Pass timestamps (not Dates) so the dependency check is by value.
 */
export function useEvents(startMs: number, endMs: number, calendarIds?: string[]) {
  const [settings] = useSettings()
  const required = calendarIds === undefined
  const calendarKey = (calendarIds ?? settings.blockingCalendarIds).join(',')
  const [state, setState] = useState<EventsState>({ events: null, loading: true, error: null })

  const refresh = useCallback(async () => {
    if (!calendarKey) {
      setState(
        required
          ? { events: null, loading: false, error: 'Pick your calendars in Settings first.' }
          : { events: [], loading: false, error: null },
      )
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const events = await listEventsMulti(calendarKey.split(','), new Date(startMs), new Date(endMs))
      setState({ events, loading: false, error: null })
    } catch (err) {
      setState({ events: null, loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  }, [calendarKey, required, startMs, endMs])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}
