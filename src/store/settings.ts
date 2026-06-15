import { useSyncExternalStore } from 'react'
import { DEFAULT_WINDOWS, type Windows } from '../lib/availability'

export interface MetricRule {
  id: string
  name: string
  keyword: string
  icon: string
  matchDescription: boolean
  /** Calendars this rule counts on. Empty/undefined = all blocking calendars. */
  calendarIds?: string[]
  /** When true, matched events block time on the Free/Check views even if marked "Free". */
  blocking?: boolean
  /** Override the global all-day rule for matched events. Undefined = inherit. */
  allDay?: 'block' | 'free'
}

export interface Settings {
  clientId: string
  blockingCalendarIds: string[]
  /** Subset of blocking calendars treated as "work" — see FreePage / adjustForWork. */
  workCalendarIds: string[]
  holidayCalendarIds: string[]
  theme: 'dark' | 'light'
  windows: Windows
  /** Earliest clock time ("HH:mm") shown on the Free view's availability bars. */
  dayStart: string
  /** How many days ahead the Free view's calendar spans. */
  lookaheadDays: number
  freeSlotCount: number
  /** ±days window of concern when scoring how isolated a pick is from other blocking events. */
  isolationWindowDays: number
  /** Whether weekends break ties when ranking the top free days. */
  favorWeekends: boolean
  /** Fraction of a window that must be open for it to count as a free slot. */
  freeThreshold: number
  /** Whether all-day events count as busy time (keyword rules can override per-rule). */
  blockAllDayEvents: boolean
  metricRules: MetricRule[]
  /** Per-metric calendar highlight color, keyed by metric key ('evenings', 'weekend', 'rule:<id>'). */
  metricColors: Record<string, string>
}

/** Highlight color used for a metric's calendar overlay when none is set. */
export const DEFAULT_METRIC_COLOR = '#fbbf24'

export const DEFAULT_SETTINGS: Settings = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  blockingCalendarIds: [],
  workCalendarIds: [],
  holidayCalendarIds: [],
  theme: 'dark',
  windows: DEFAULT_WINDOWS,
  dayStart: '08:00',
  lookaheadDays: 60,
  freeSlotCount: 10,
  isolationWindowDays: 3,
  favorWeekends: true,
  freeThreshold: 0.75,
  blockAllDayEvents: false,
  metricRules: [
    { id: 'date-nights', name: 'Date nights', keyword: 'date', icon: '❤️', matchDescription: false },
  ],
  metricColors: {},
}

const STORAGE_KEY = 'scheddy.settings'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // Windows are fully user-owned (add/remove), so take the stored set
      // as-is rather than merging defaults back in — otherwise a removed
      // default window would reappear on reload.
      windows: parsed.windows ?? DEFAULT_SETTINGS.windows,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

let current: Settings = loadSettings()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribe, getSettings)
  return [settings, updateSettings]
}
