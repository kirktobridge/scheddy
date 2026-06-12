import { useCallback, useEffect, useState } from 'react'
import { listEventsMulti, type GEvent } from '../api/calendar'
import { useSettings } from '../store/settings'

interface EventsState {
  events: GEvent[] | null
  loading: boolean
  error: string | null
}

/**
 * Fetches events from all blocking calendars for [startMs, endMs].
 * Pass timestamps (not Dates) so the dependency check is by value.
 */
export function useEvents(startMs: number, endMs: number) {
  const [settings] = useSettings()
  const calendarKey = settings.blockingCalendarIds.join(',')
  const [state, setState] = useState<EventsState>({ events: null, loading: true, error: null })

  const refresh = useCallback(async () => {
    if (!calendarKey) {
      setState({ events: null, loading: false, error: 'Pick your calendars in Settings first.' })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const events = await listEventsMulti(calendarKey.split(','), new Date(startMs), new Date(endMs))
      setState({ events, loading: false, error: null })
    } catch (err) {
      setState({ events: null, loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  }, [calendarKey, startMs, endMs])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}
