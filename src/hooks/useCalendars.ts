import { useEffect, useState } from 'react'
import { listCalendars, type GCalendar } from '../api/calendar'
import { hasEverSignedIn } from '../auth/google'
import { isMockMode } from '../api/mock'

/**
 * Loads the user's calendar list once (when signed in, or always in mock mode).
 * Used for calendar metadata like per-calendar colors; returns null until
 * loaded / when signed out.
 */
export function useCalendars(): GCalendar[] | null {
  const [calendars, setCalendars] = useState<GCalendar[] | null>(null)

  useEffect(() => {
    if (!hasEverSignedIn() && !isMockMode()) return
    let alive = true
    listCalendars()
      .then((cals) => {
        if (alive) setCalendars(cals)
      })
      .catch(() => {
        /* color metadata is non-critical — ignore load errors */
      })
    return () => {
      alive = false
    }
  }, [])

  return calendars
}
