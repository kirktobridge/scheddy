import { useSyncExternalStore } from 'react'
import type { Windows } from '../lib/availability'

export interface MetricRule {
  id: string
  name: string
  keyword: string
  icon: string
  matchDescription: boolean
}

export interface Settings {
  clientId: string
  blockingCalendarIds: string[]
  windows: Windows
  freeSlotCount: number
  /** Fraction of a window that must be open for it to count as a free slot. */
  freeThreshold: number
  metricRules: MetricRule[]
}

export const DEFAULT_SETTINGS: Settings = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  blockingCalendarIds: [],
  windows: {
    morning: { start: '08:00', end: '12:00' },
    afternoon: { start: '12:00', end: '17:00' },
    evening: { start: '17:00', end: '22:00' },
  },
  freeSlotCount: 6,
  freeThreshold: 0.75,
  metricRules: [
    { id: 'date-nights', name: 'Date nights', keyword: 'date', icon: '❤️', matchDescription: false },
  ],
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
      windows: { ...DEFAULT_SETTINGS.windows, ...(parsed.windows ?? {}) },
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
