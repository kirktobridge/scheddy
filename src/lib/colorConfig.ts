import type { Settings } from '../store/settings'

/**
 * A single configurable color. `key` is the stable storage key used in
 * `settings.colors`; `cssVars` lists any Tailwind v4 theme variables this color
 * retints at runtime (see applyColorVars).
 */
export interface ColorEntry {
  key: string
  label: string
  default: string
  description?: string
  cssVars?: string[]
}

export interface ColorGroup {
  id: string
  title: string
  description?: string
  entries: ColorEntry[]
}

/**
 * Source of truth for the app's configurable semantic colors. Add a new color by
 * adding an entry here — the Colors settings panel renders straight from this.
 * Only colors that actually take effect when changed belong in this list.
 */
export const COLOR_GROUPS: ColorGroup[] = [
  {
    id: 'accent',
    title: 'Accent',
    description: 'The primary highlight color used across buttons, tabs, rings and free-time bars.',
    entries: [
      {
        key: 'accent.primary',
        label: 'Primary accent',
        default: '#10b981',
        // Tailwind v4 compiles `emerald-500` (and its /10, /20 opacity variants)
        // to var(--color-emerald-500), so overriding this retints the accent app-wide.
        cssVars: ['--color-emerald-500'],
      },
    ],
  },
  {
    id: 'metric',
    title: 'Metric highlights',
    description: 'Fallback color for a metric’s calendar highlight. Per-metric overrides are set on the Metrics panel.',
    entries: [{ key: 'metric.default', label: 'Default highlight', default: '#fbbf24' }],
  },
  {
    id: 'relationship',
    title: 'Relationship overlays',
    description: 'Colors for the partner-availability overlays on the Free view.',
    entries: [
      { key: 'relationship.partnerOff', label: 'Partner not working', default: '#3b82f6' },
      { key: 'relationship.overlap', label: 'Overlap', default: '#ec4899' },
      { key: 'relationship.dateMarker', label: 'Date candidate marker', default: '#ec4899' },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendars',
    entries: [
      {
        key: 'calendar.fallback',
        label: 'Fallback calendar color',
        default: '#64748b',
        description: 'Used when a calendar has no color of its own.',
      },
    ],
  },
]

const ENTRIES_BY_KEY: Record<string, ColorEntry> = Object.fromEntries(
  COLOR_GROUPS.flatMap((g) => g.entries).map((e) => [e.key, e]),
)

/** Built-in default for a registry color key. */
export function colorDefault(key: string): string {
  return ENTRIES_BY_KEY[key]?.default ?? '#000000'
}

/** Resolve a color: user override if set, otherwise the registry default. */
export function getColor(settings: Settings, key: string): string {
  return settings.colors[key] ?? colorDefault(key)
}

/** Push every CSS-variable-backed color onto :root so Tailwind utilities retint live. */
export function applyColorVars(settings: Settings): void {
  const root = document.documentElement
  for (const group of COLOR_GROUPS) {
    for (const entry of group.entries) {
      if (!entry.cssVars) continue
      const value = getColor(settings, entry.key)
      for (const cssVar of entry.cssVars) root.style.setProperty(cssVar, value)
    }
  }
}
