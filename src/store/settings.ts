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
  /** Calendars whose events are listed in the selected-day schedule on the Free view (empty = none). */
  dayEventCalendarIds: string[]
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
  /** Calendars whose all-day events block time even when blockAllDayEvents is off. */
  allDayBlockingCalendarIds: string[]
  metricRules: MetricRule[]
  /** Per-metric calendar highlight color, keyed by metric key ('evenings', 'weekend', 'rule:<id>'). */
  metricColors: Record<string, string>
  /** Overrides for the app's configurable semantic colors, keyed by colorConfig entry key. */
  colors: Record<string, string>

  /** Relationship mode: surfaces a partner's availability on the Free view (see relationship.ts). */
  relationshipMode: boolean
  /** Partner's display name, used in relationship labels (blank → "Partner"). */
  partnerName: string
  /** Whether date candidates lean toward weekends, weekdays, or neither. */
  datePreference: 'weekend' | 'weekday' | 'either'
  /** Whether date candidates prioritize days the partner is off work. */
  dateFavorPartnerOff: boolean
  /** All of the partner's busy calendars — drives mutual free time + date-candidate isolation. */
  partnerBlockingCalendarIds: string[]
  /** Subset of the partner's calendars treated as "work" — drives the "not working" overlay. */
  partnerWorkCalendarIds: string[]
  /** Shared calendars whose events block BOTH partners (e.g. a joint events calendar). */
  jointCalendarIds: string[]
  /** Minimum mutual free hours for a day to count as "overlapping free time" (button 2). */
  overlapMinHours: number
  /** Minimum mutual free hours for a day to be a date candidate (button 3). */
  dateMinHours: number
  /** How many date candidates to surface (button 3). */
  dateCandidateCount: number
  /** Which metric rule's matches count as an already-scheduled date (excludes that week). */
  dateRuleId: string
  /** Flag dates as "overdue" when this many days have passed since the last one (0 disables). */
  dateCadenceDays: number
  /** Whether the Free-page relationship card is expanded (remembered across reloads). */
  relationshipPanelOpen: boolean
  /** Calendar a booked date is written to (blank → first joint, then first blocking). */
  dateTargetCalendarId: string
  /** Title for a booked date — keep a date keyword in it so the week self-excludes. */
  dateEventTitle: string
}

export const DEFAULT_SETTINGS: Settings = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  blockingCalendarIds: [],
  workCalendarIds: [],
  holidayCalendarIds: [],
  dayEventCalendarIds: [],
  theme: 'dark',
  windows: DEFAULT_WINDOWS,
  dayStart: '08:00',
  lookaheadDays: 60,
  freeSlotCount: 10,
  isolationWindowDays: 3,
  favorWeekends: true,
  freeThreshold: 0.75,
  blockAllDayEvents: false,
  allDayBlockingCalendarIds: [],
  metricRules: [
    { id: 'date-nights', name: 'Date nights', keyword: 'date', icon: '❤️', matchDescription: false },
  ],
  metricColors: {},
  colors: {},
  relationshipMode: false,
  partnerName: '',
  datePreference: 'weekend',
  dateFavorPartnerOff: true,
  partnerBlockingCalendarIds: [],
  partnerWorkCalendarIds: [],
  jointCalendarIds: [],
  overlapMinHours: 2,
  dateMinHours: 3,
  dateCandidateCount: 3,
  dateRuleId: 'date-nights',
  dateCadenceDays: 14,
  relationshipPanelOpen: false,
  dateTargetCalendarId: '',
  dateEventTitle: 'Date ❤️',
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
