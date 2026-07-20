import type { Settings } from '../store/settings'

/** How a token is edited and rendered in the Appearance panel. */
export type TokenType = 'color' | 'length' | 'font'

/**
 * A single configurable design token. `key` is the stable storage key used in
 * `settings.tokens`; `cssVars` lists the Tailwind v4 theme variables this token
 * drives on :root at runtime (see applyTokenVars). A token with no `cssVars` is
 * read in JS only (e.g. a calendar swatch color) and never written to :root.
 */
export interface TokenEntry {
  key: string
  label: string
  /** Built-in value: shown as the resolved default and used as the reset baseline. */
  default: string
  type: TokenType
  description?: string
  cssVars?: string[]
  /** `length` sliders: numeric bounds expressed in `unit`. */
  unit?: string
  min?: number
  max?: number
  step?: number
  /** `font` dropdowns: selectable stacks (value is the full font-family list). */
  options?: { label: string; value: string }[]
}

/** Shared font-stack choices for the typography dropdowns. */
const SANS_FONTS: { label: string; value: string }[] = [
  {
    label: 'System default',
    value:
      'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  },
  { label: 'Helvetica / Arial', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, Tahoma, sans-serif' },
  { label: 'Trebuchet', value: '"Trebuchet MS", system-ui, sans-serif' },
  { label: 'Georgia (serif)', value: 'Georgia, Cambria, "Times New Roman", serif' },
]

const MONO_FONTS: { label: string; value: string }[] = [
  {
    label: 'System default',
    value:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
  { label: 'Consolas', value: 'Consolas, "Liberation Mono", monospace' },
  { label: 'Menlo / Monaco', value: 'Menlo, Monaco, monospace' },
]

export interface TokenGroup {
  id: string
  /** Top-level category this group belongs to (drives the section grouping). */
  category: 'color' | 'typography' | 'spacing' | 'radius'
  title: string
  description?: string
  entries: TokenEntry[]
}

/**
 * Source of truth for the app's configurable design tokens. Add a token by adding
 * an entry here — the Appearance panel renders straight from this list, and
 * applyTokenVars pushes any `cssVars`-backed token onto :root. Only tokens that
 * actually take effect when changed belong here.
 *
 * Defaults mirror Tailwind v4's compiled theme variables; application only ever
 * writes user overrides (applyTokenVars), so an unset token falls back to the
 * stylesheet's own value rather than this string.
 */
export const TOKEN_GROUPS: TokenGroup[] = [
  {
    id: 'accent',
    category: 'color',
    title: 'Accent',
    description: 'The primary highlight color used across buttons, tabs, rings and free-time bars.',
    entries: [
      {
        key: 'accent.primary',
        label: 'Primary accent',
        type: 'color',
        default: '#10b981',
        // Tailwind v4 compiles `emerald-500` (and its /10, /20 opacity variants)
        // to var(--color-emerald-500), so overriding this retints the accent app-wide.
        cssVars: ['--color-emerald-500'],
      },
    ],
  },
  {
    id: 'metric',
    category: 'color',
    title: 'Metric highlights',
    description: 'Fallback color for a metric’s calendar highlight. Per-metric overrides are set below.',
    entries: [{ key: 'metric.default', label: 'Default highlight', type: 'color', default: '#fbbf24' }],
  },
  {
    id: 'relationship',
    category: 'color',
    title: 'Relationship overlays',
    description: 'Colors for the partner-availability overlays on the Free view.',
    entries: [
      { key: 'relationship.partnerOff', label: 'Partner not working', type: 'color', default: '#3b82f6' },
      { key: 'relationship.overlap', label: 'Overlap', type: 'color', default: '#ec4899' },
      { key: 'relationship.dateMarker', label: 'Date candidate marker', type: 'color', default: '#ec4899' },
    ],
  },
  {
    id: 'calendar',
    category: 'color',
    title: 'Calendars',
    entries: [
      {
        key: 'calendar.fallback',
        label: 'Fallback calendar color',
        type: 'color',
        default: '#64748b',
        description: 'Used when a calendar has no color of its own.',
      },
    ],
  },
  {
    id: 'typography',
    category: 'typography',
    title: 'Typography',
    description: 'Fonts and base text size.',
    entries: [
      {
        key: 'font.sans',
        label: 'UI font',
        type: 'font',
        description: 'Font stack for all interface text.',
        default: SANS_FONTS[0].value,
        options: SANS_FONTS,
        cssVars: ['--font-sans'],
      },
      {
        key: 'font.mono',
        label: 'Monospace font',
        type: 'font',
        description: 'Used for hex values and other code-like text.',
        default: MONO_FONTS[0].value,
        options: MONO_FONTS,
        cssVars: ['--font-mono'],
      },
      {
        key: 'text.base',
        label: 'Base text size',
        type: 'length',
        default: '1rem',
        unit: 'rem',
        min: 0.75,
        max: 1.5,
        step: 0.05,
        cssVars: ['--text-base'],
      },
    ],
  },
  {
    id: 'spacing',
    category: 'spacing',
    title: 'Spacing',
    description: 'Base spacing unit — scales padding, margins and gaps across the whole app.',
    entries: [
      {
        key: 'spacing.base',
        label: 'Spacing unit',
        type: 'length',
        default: '0.25rem',
        unit: 'rem',
        min: 0.15,
        max: 0.4,
        step: 0.01,
        cssVars: ['--spacing'],
      },
    ],
  },
  {
    id: 'radius',
    category: 'radius',
    title: 'Corner radius',
    description: 'Roundness of cards, buttons, inputs and pills.',
    entries: [
      { key: 'radius.md', label: 'Medium radius', type: 'length', default: '0.375rem', unit: 'rem', min: 0, max: 1.5, step: 0.025, cssVars: ['--radius-md'] },
      { key: 'radius.lg', label: 'Large radius', type: 'length', default: '0.5rem', unit: 'rem', min: 0, max: 1.5, step: 0.025, cssVars: ['--radius-lg'] },
      { key: 'radius.xl', label: 'Extra-large radius', type: 'length', default: '0.75rem', unit: 'rem', min: 0, max: 2, step: 0.025, cssVars: ['--radius-xl'] },
    ],
  },
]

const ENTRIES_BY_KEY: Record<string, TokenEntry> = Object.fromEntries(
  TOKEN_GROUPS.flatMap((g) => g.entries).map((e) => [e.key, e]),
)

/** Built-in default for a registry token key. */
export function tokenDefault(key: string): string {
  return ENTRIES_BY_KEY[key]?.default ?? ''
}

/** Resolve a token: user override if set, otherwise the registry default. */
export function getToken(settings: Settings, key: string): string {
  return settings.tokens[key] ?? tokenDefault(key)
}

/** Back-compat alias for the color tokens read across the app. */
export const getColor = getToken

/**
 * Push user-overridden, CSS-variable-backed tokens onto :root so Tailwind
 * utilities retint/resize live. Unset tokens are removed so they fall back to
 * the stylesheet's compiled default rather than a (possibly inexact) copy here.
 */
export function applyTokenVars(settings: Settings): void {
  const root = document.documentElement
  for (const group of TOKEN_GROUPS) {
    for (const entry of group.entries) {
      if (!entry.cssVars) continue
      const override = settings.tokens[entry.key]
      for (const cssVar of entry.cssVars) {
        if (override) root.style.setProperty(cssVar, override)
        else root.style.removeProperty(cssVar)
      }
    }
  }
}
