// @vitest-environment jsdom
import { afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MOCK_CALENDARS, MOCK_SETTINGS } from '../../src/api/mock'
import { DEFAULT_SETTINGS, updateSettings } from '../../src/store/settings'

/**
 * Shared harness for validating the app against the mock calendar/event data
 * (the same `?mock=1` fixtures the user demos with). Flips on mock mode, seeds
 * the store with MOCK_SETTINGS, and renders a component — so DOM tests exercise
 * the real mock API path (listCalendars / listEventsMulti short-circuit to the
 * seeded fixtures) without any network or Google auth.
 */
export const MOCK_FLAG = 'scheddy.mock'

/** calendarId → color, mirroring what FreePage builds from useCalendars. */
export const mockCalendarColors = new Map(MOCK_CALENDARS.map((c) => [c.id, c.backgroundColor]))

/** Enable mock mode and load MOCK_SETTINGS into the live settings store. */
export function enableMockMode(overrides: Partial<typeof DEFAULT_SETTINGS> = {}) {
  localStorage.setItem(MOCK_FLAG, '1')
  updateSettings({ ...DEFAULT_SETTINGS, ...MOCK_SETTINGS, ...overrides })
}

/** Render under mock mode; returns Testing Library's render result. */
export function renderMock(ui: ReactElement, overrides: Partial<typeof DEFAULT_SETTINGS> = {}) {
  enableMockMode(overrides)
  return render(ui)
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  updateSettings(DEFAULT_SETTINGS)
})
