import { Fragment, useEffect, useState } from 'react'
import { hasEverSignedIn, signIn, signOut } from '../auth/google'
import { listCalendars, type GCalendar } from '../api/calendar'
import { DEFAULT_WINDOWS, windowKeys } from '../lib/availability'
import { getSettings, useSettings, type DateRankFactor, type MetricRule, type Settings } from '../store/settings'
import { ErrorBanner } from '../components/Banner'
import TokenField from '../components/TokenField'
import { TOKEN_GROUPS, getColor, getToken } from '../lib/designTokens'
import { normalizeRankOrder, resolveDateRule } from '../lib/relationship'

const INPUT =
  'rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
const INPUT_NESTED =
  'rounded-lg border border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'

type CatKey =
  | 'account'
  | 'appearance'
  | 'calendars'
  | 'availability'
  | 'metrics'
  | 'relationship'

const CATEGORIES: { key: CatKey; label: string; icon: string }[] = [
  { key: 'account', label: 'Account', icon: '👤' },
  { key: 'appearance', label: 'Appearance', icon: '🎨' },
  { key: 'calendars', label: 'Calendars', icon: '📅' },
  { key: 'availability', label: 'Availability', icon: '🕐' },
  { key: 'metrics', label: 'Metrics', icon: '📌' },
  { key: 'relationship', label: 'Relationship', icon: '💑' },
]

type Update = (patch: Partial<Settings>) => void

export default function SettingsPage() {
  const [settings, update] = useSettings()
  const [signedIn, setSignedIn] = useState(hasEverSignedIn())
  const [calendars, setCalendars] = useState<GCalendar[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<CatKey | null>(null)

  const loadCalendars = async () => {
    try {
      setCalendars(await listCalendars())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    if (signedIn) void loadCalendars()
  }, [signedIn])

  const handleSignIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await signIn()
      setSignedIn(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setSignedIn(false)
    setCalendars(null)
  }

  const blockingCalendars = calendars?.filter((c) => settings.blockingCalendarIds.includes(c.id)) ?? null

  const renderPanel = (key: CatKey) => {
    switch (key) {
      case 'account':
        return (
          <AccountPanel
            settings={settings}
            update={update}
            signedIn={signedIn}
            busy={busy}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
        )
      case 'appearance':
        return <AppearancePanel settings={settings} update={update} />
      case 'calendars':
        return (
          <CalendarsPanel signedIn={signedIn} calendars={calendars} settings={settings} update={update} />
        )
      case 'availability':
        return <AvailabilityPanel settings={settings} update={update} />
      case 'metrics':
        return <MetricsPanel settings={settings} update={update} blockingCalendars={blockingCalendars} />
      case 'relationship':
        return <RelationshipPanel settings={settings} update={update} calendars={calendars} />
    }
  }

  const desktopActive = active ?? 'account'

  return (
    <div>
      {/* Mobile: drill-down list → subpage */}
      <div className="lg:hidden">
        {active === null ? (
          <>
            <h1 className="mb-4 text-xl font-bold">Settings</h1>
            <div className="space-y-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setActive(c.key)}
                  className="flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left text-sm shadow-sm dark:bg-slate-800 dark:shadow-none"
                >
                  <span className="text-xl leading-none">{c.icon}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{c.label}</span>
                  <span className="ml-auto text-slate-400">›</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setActive(null)}
                className="-ml-1 rounded-lg px-2 py-1 text-sm text-emerald-600 dark:text-emerald-400"
              >
                ‹ Back
              </button>
              <h1 className="text-xl font-bold">{CATEGORIES.find((c) => c.key === active)?.label}</h1>
            </div>
            {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
            {renderPanel(active)}
          </>
        )}
      </div>

      {/* Desktop: sub-nav + detail pane */}
      <div className="hidden lg:flex lg:gap-8">
        <nav className="w-48 shrink-0 space-y-1">
          <h1 className="mb-4 text-xl font-bold">Settings</h1>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
                desktopActive === c.key
                  ? 'bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-lg leading-none">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-6">
          {error && <ErrorBanner message={error} />}
          {renderPanel(desktopActive)}
        </div>
      </div>
    </div>
  )
}

function AccountPanel({
  settings,
  update,
  signedIn,
  busy,
  onSignIn,
  onSignOut,
}: {
  settings: Settings
  update: Update
  signedIn: boolean
  busy: boolean
  onSignIn: () => void
  onSignOut: () => void
}) {
  return (
    <Section title="Google account">
      <label className="block text-sm text-slate-600 dark:text-slate-400">
        OAuth Client ID
        <input
          type="text"
          value={settings.clientId}
          onChange={(e) => update({ clientId: e.target.value.trim() })}
          placeholder="xxxxx.apps.googleusercontent.com"
          className={`mt-1 w-full px-3 py-2 text-sm ${INPUT}`}
        />
      </label>
      {signedIn ? (
        <button
          onClick={onSignOut}
          className="w-full rounded-lg bg-slate-300 py-2 text-sm font-medium dark:bg-slate-700"
        >
          Sign out
        </button>
      ) : (
        <button
          onClick={onSignIn}
          disabled={busy || !settings.clientId}
          className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-emerald-950 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>
      )}
    </Section>
  )
}

export function AppearancePanel({ settings, update }: { settings: Settings; update: Update }) {
  const setToken = (key: string, value: string) =>
    update({ tokens: { ...settings.tokens, [key]: value } })
  const resetToken = (key: string) => {
    const { [key]: _, ...rest } = settings.tokens
    update({ tokens: rest })
  }
  const resetGroup = (keys: string[]) => {
    const rest = { ...settings.tokens }
    for (const k of keys) delete rest[k]
    update({ tokens: rest })
  }
  const groupHasOverrides = (keys: string[]) => keys.some((k) => k in settings.tokens)
  const hasOverrides = Object.keys(settings.tokens).length > 0

  return (
    <>
      <Section title="Appearance">
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ theme: mode })}
              className={`flex-1 rounded-lg py-2 text-sm capitalize ${
                settings.theme === mode
                  ? 'bg-emerald-500 font-medium text-emerald-950'
                  : 'bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:shadow-none'
              }`}
            >
              {mode === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>
          ))}
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Design tokens
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live controls for every CSS variable the app theme is built from.
          </p>
        </div>
        {hasOverrides && (
          <button
            onClick={() => update({ tokens: {} })}
            className="shrink-0 rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm text-rose-600 dark:text-rose-400"
          >
            Reset all
          </button>
        )}
      </div>

      {TOKEN_GROUPS.map((group) => {
        const keys = group.entries.map((e) => e.key)
        return (
          <Section
            key={group.id}
            title={group.title}
            action={
              groupHasOverrides(keys) && (
                <button
                  onClick={() => resetGroup(keys)}
                  className="text-xs text-slate-500 underline dark:text-slate-400"
                >
                  Reset group
                </button>
              )
            }
          >
            {group.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{group.description}</p>
            )}
            <div className="rounded-lg bg-white px-3 py-1 shadow-sm dark:bg-slate-800 dark:shadow-none">
              {group.entries.map((entry) => (
                <TokenField
                  key={entry.key}
                  entry={entry}
                  value={getToken(settings, entry.key)}
                  onChange={(value) => setToken(entry.key, value)}
                  onReset={() => resetToken(entry.key)}
                />
              ))}
            </div>
          </Section>
        )
      })}
    </>
  )
}

export function CalendarsPanel({
  signedIn,
  calendars,
  settings,
  update,
}: {
  signedIn: boolean
  calendars: GCalendar[] | null
  settings: Settings
  update: Update
}) {
  const [query, setQuery] = useState('')
  // Auto-by-role row groups; "Unused" starts collapsed. Ephemeral (not persisted).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['unused']))
  const [legendOpen, setLegendOpen] = useState(false)

  if (!signedIn) {
    return <p className="text-sm text-slate-500">Sign in on the Account page first to pick calendars.</p>
  }
  if (!calendars) return <p className="text-sm text-slate-500">Loading calendars…</p>

  const has = (
    field:
      | 'blockingCalendarIds'
      | 'workCalendarIds'
      | 'holidayCalendarIds'
      | 'dayEventCalendarIds'
      | 'horizonCalendarIds',
    id: string,
  ) => settings[field].includes(id)

  const toggleBlocking = (id: string) => {
    if (has('blockingCalendarIds', id)) {
      // Removing "blocks time" also strips the work flag (work ⊆ blocking).
      update({
        blockingCalendarIds: settings.blockingCalendarIds.filter((x) => x !== id),
        workCalendarIds: settings.workCalendarIds.filter((x) => x !== id),
      })
    } else {
      update({ blockingCalendarIds: [...settings.blockingCalendarIds, id] })
    }
  }

  const toggleWork = (id: string) => {
    if (!has('blockingCalendarIds', id)) return
    update({
      workCalendarIds: has('workCalendarIds', id)
        ? settings.workCalendarIds.filter((x) => x !== id)
        : [...settings.workCalendarIds, id],
    })
  }

  // Per-calendar all-day opt-in: blocks even when the global setting is off.
  // When the global setting is on, every calendar already blocks, so the pill
  // is shown active-but-locked.
  const allDayOn = (id: string) =>
    settings.blockAllDayEvents || settings.allDayBlockingCalendarIds.includes(id)
  const toggleAllDay = (id: string) =>
    update({
      allDayBlockingCalendarIds: settings.allDayBlockingCalendarIds.includes(id)
        ? settings.allDayBlockingCalendarIds.filter((x) => x !== id)
        : [...settings.allDayBlockingCalendarIds, id],
    })

  const toggleHoliday = (id: string) =>
    update({
      holidayCalendarIds: has('holidayCalendarIds', id)
        ? settings.holidayCalendarIds.filter((x) => x !== id)
        : [...settings.holidayCalendarIds, id],
    })

  const toggleDayEvents = (id: string) =>
    update({
      dayEventCalendarIds: has('dayEventCalendarIds', id)
        ? settings.dayEventCalendarIds.filter((x) => x !== id)
        : [...settings.dayEventCalendarIds, id],
    })

  const toggleHorizon = (id: string) =>
    update({
      horizonCalendarIds: has('horizonCalendarIds', id)
        ? settings.horizonCalendarIds.filter((x) => x !== id)
        : [...settings.horizonCalendarIds, id],
    })

  const hasIn = (field: 'partnerBlockingCalendarIds' | 'partnerWorkCalendarIds' | 'jointCalendarIds', id: string) =>
    settings[field].includes(id)

  const toggleIn = (
    field: 'partnerBlockingCalendarIds' | 'partnerWorkCalendarIds' | 'jointCalendarIds',
    id: string,
  ) =>
    update({
      [field]: hasIn(field, id) ? settings[field].filter((x) => x !== id) : [...settings[field], id],
    })

  // Partner "work" and "joint" ⊆ partner "blocks time", mirroring the personal calendars above.
  const togglePartnerBlocking = (id: string) => {
    if (hasIn('partnerBlockingCalendarIds', id)) {
      update({
        partnerBlockingCalendarIds: settings.partnerBlockingCalendarIds.filter((x) => x !== id),
        partnerWorkCalendarIds: settings.partnerWorkCalendarIds.filter((x) => x !== id),
        jointCalendarIds: settings.jointCalendarIds.filter((x) => x !== id),
      })
    } else {
      update({ partnerBlockingCalendarIds: [...settings.partnerBlockingCalendarIds, id] })
    }
  }

  const togglePartnerWork = (id: string) => {
    if (!hasIn('partnerBlockingCalendarIds', id)) return
    toggleIn('partnerWorkCalendarIds', id)
  }

  // Joint events block the partner too, so marking joint implies partner "blocks time".
  const toggleJoint = (id: string) => {
    if (hasIn('jointCalendarIds', id)) {
      update({ jointCalendarIds: settings.jointCalendarIds.filter((x) => x !== id) })
    } else {
      update({
        jointCalendarIds: [...settings.jointCalendarIds, id],
        partnerBlockingCalendarIds: hasIn('partnerBlockingCalendarIds', id)
          ? settings.partnerBlockingCalendarIds
          : [...settings.partnerBlockingCalendarIds, id],
      })
    }
  }

  const q = query.trim().toLowerCase()
  const shown = q ? calendars.filter((c) => c.summary.toLowerCase().includes(q)) : calendars

  const rel = settings.relationshipMode
  // All-day opt-in only matters for a calendar that blocks in some capacity.
  const blocksAny = (id: string) =>
    has('blockingCalendarIds', id) || hasIn('partnerBlockingCalendarIds', id) || hasIn('jointCalendarIds', id)

  type Col = {
    key: string
    label: string
    help: string
    active: (id: string) => boolean
    disabled: (id: string) => boolean
    toggle: (id: string) => void
  }
  const youCols: Col[] = [
    {
      key: 'blocking',
      label: 'Blocks time',
      help: 'events here mark you busy.',
      active: (id) => has('blockingCalendarIds', id),
      disabled: () => false,
      toggle: toggleBlocking,
    },
    {
      key: 'work',
      label: 'Work',
      help: 'still busy, but evenings with only work read "free after work" on the Free tab (needs Blocks time).',
      active: (id) => has('workCalendarIds', id),
      disabled: (id) => !has('blockingCalendarIds', id),
      toggle: toggleWork,
    },
    {
      key: 'holiday',
      label: 'Holiday',
      help: 'adds notes like "2 days before Memorial Day". Tip: subscribe to "Holidays in United States" in Google Calendar.',
      active: (id) => has('holidayCalendarIds', id),
      disabled: () => false,
      toggle: toggleHoliday,
    },
    {
      key: 'dayEvents',
      label: 'Show events',
      help: "list this calendar's events in the selected-day schedule on the Free tab.",
      active: (id) => has('dayEventCalendarIds', id),
      disabled: () => false,
      toggle: toggleDayEvents,
    },
    {
      key: 'horizon',
      label: 'Horizon',
      help: 'the latest event here sets how far ahead the Free tab looks (bounded by the min/max in Availability).',
      active: (id) => has('horizonCalendarIds', id),
      disabled: () => false,
      toggle: toggleHorizon,
    },
    {
      key: 'allDay',
      label: 'All-day',
      help: 'count this calendar’s all-day events as busy (e.g. a "Vacation" or "Anniversary" day), even with the global all-day setting off.',
      active: (id) => allDayOn(id),
      disabled: (id) => settings.blockAllDayEvents || !blocksAny(id),
      toggle: toggleAllDay,
    },
  ]
  const relCols: Col[] = [
    {
      key: 'pBlocking',
      label: 'Partner busy',
      help: "your partner's calendars; used to find mutual free time and space out date picks.",
      active: (id) => hasIn('partnerBlockingCalendarIds', id),
      disabled: () => false,
      toggle: togglePartnerBlocking,
    },
    {
      key: 'pWork',
      label: 'Partner work',
      help: 'drives the "off work" overlay on the Free tab (needs Partner busy).',
      active: (id) => hasIn('partnerWorkCalendarIds', id),
      disabled: (id) => !hasIn('partnerBlockingCalendarIds', id),
      toggle: togglePartnerWork,
    },
    {
      key: 'joint',
      label: 'Joint',
      help: 'shared events that block both of you (e.g. a couples calendar).',
      active: (id) => hasIn('jointCalendarIds', id),
      disabled: () => false,
      toggle: toggleJoint,
    },
  ]
  const cols = rel ? [...youCols, ...relCols] : youCols
  const relStart = relCols[0].key

  // Each calendar lands in exactly one auto-derived bucket.
  const roleOf = (id: string): 'blocking' | 'other' | 'unused' => {
    if (has('blockingCalendarIds', id)) return 'blocking'
    const other =
      has('holidayCalendarIds', id) ||
      has('dayEventCalendarIds', id) ||
      has('horizonCalendarIds', id) ||
      hasIn('partnerBlockingCalendarIds', id) ||
      hasIn('partnerWorkCalendarIds', id) ||
      hasIn('jointCalendarIds', id)
    return other ? 'other' : 'unused'
  }
  const groups = (
    [
      { key: 'blocking', label: 'Blocking' },
      { key: 'other', label: 'Other roles' },
      { key: 'unused', label: 'Unused' },
    ] as const
  )
    .map((g) => ({ ...g, cals: shown.filter((c) => roleOf(c.id) === g.key) }))
    .filter((g) => g.cals.length > 0)

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <Section title="Calendars">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search calendars…"
        className={`w-full px-3 py-2 text-sm ${INPUT}`}
      />
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">No calendars match "{query}".</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 bg-slate-100 px-3 py-2 text-left font-medium text-slate-500 dark:bg-slate-900"
                >
                  Calendar
                </th>
                <th
                  colSpan={youCols.length}
                  className="px-2 py-1.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  You
                </th>
                {rel && (
                  <th
                    colSpan={relCols.length}
                    className="border-l border-slate-200 px-2 py-1.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-slate-700"
                  >
                    {settings.partnerName.trim() || 'Relationship'}
                  </th>
                )}
              </tr>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    title={`${c.label} — ${c.help}`}
                    className={`px-2 py-1.5 text-center align-bottom text-xs font-medium whitespace-nowrap text-slate-600 dark:text-slate-300 ${
                      rel && c.key === relStart ? 'border-l border-slate-200 dark:border-slate-700' : ''
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const open = !collapsed.has(g.key)
                return (
                  <Fragment key={g.key}>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <th colSpan={1 + cols.length} scope="colgroup" className="sticky left-0 px-1 py-1 text-left">
                        <button
                          onClick={() => toggleGroup(g.key)}
                          aria-expanded={open}
                          className="flex w-full items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
                        >
                          <span className="text-[10px]">{open ? '▾' : '▸'}</span>
                          {g.label}
                          <span className="font-normal text-slate-400">({g.cals.length})</span>
                        </button>
                      </th>
                    </tr>
                    {open &&
                      g.cals.map((cal) => (
                        <tr key={cal.id} className="border-t border-slate-100 dark:border-slate-800">
                          <th
                            scope="row"
                            className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-normal dark:bg-slate-800"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: cal.backgroundColor ?? getColor(settings, 'calendar.fallback') }}
                              />
                              <span className="min-w-0 max-w-[40vw] truncate text-slate-800 dark:text-slate-200">
                                {cal.summary}
                              </span>
                            </span>
                          </th>
                          {cols.map((c) => (
                            <td
                              key={c.key}
                              className={`px-2 py-1.5 text-center ${
                                rel && c.key === relStart ? 'border-l border-slate-100 dark:border-slate-800' : ''
                              }`}
                            >
                              <CellToggle
                                active={c.active(cal.id)}
                                disabled={c.disabled(cal.id)}
                                onToggle={() => c.toggle(cal.id)}
                                label={`${cal.summary} — ${c.label}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-1 text-xs text-slate-500">
        <button
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400"
        >
          <span className="text-[10px]">{legendOpen ? '▾' : '▸'}</span>
          What do these mean?
        </button>
        {legendOpen && (
          <div className="space-y-1 pt-2">
            {cols.map((c) => (
              <p key={c.key}>
                <strong className="text-slate-600 dark:text-slate-400">{c.label}</strong> — {c.help}
              </p>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

function CellToggle({
  active,
  disabled,
  onToggle,
  label,
}: {
  active: boolean
  disabled?: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold ${
        active
          ? 'border-emerald-500 bg-emerald-500 text-emerald-950'
          : 'border-slate-300 text-transparent dark:border-slate-600'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      ✓
    </button>
  )
}

function AvailabilityPanel({ settings, update }: { settings: Settings; update: Update }) {
  const [newWindow, setNewWindow] = useState('')

  const dayStartHour = Number(settings.dayStart.split(':')[0]) || 0

  const addWindow = () => {
    const name = newWindow.trim()
    if (!name || settings.windows[name]) return
    update({ windows: { ...settings.windows, [name]: { start: '09:00', end: '10:00' } } })
    setNewWindow('')
  }

  const removeWindow = (key: string) => {
    if (Object.keys(settings.windows).length <= 1) return
    const next = { ...settings.windows }
    delete next[key]
    update({ windows: next })
  }

  const canAddWindow = newWindow.trim() !== '' && !settings.windows[newWindow.trim()]

  return (
    <>
      <Section title="Time windows">
        {windowKeys(settings.windows).map((key) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0 truncate capitalize text-slate-700 dark:text-slate-300">{key}</span>
            <input
              type="time"
              value={settings.windows[key].start}
              onChange={(e) =>
                update({ windows: { ...settings.windows, [key]: { ...settings.windows[key], start: e.target.value } } })
              }
              className={`px-2 py-1 ${INPUT}`}
            />
            <span className="text-slate-500">–</span>
            <input
              type="time"
              value={settings.windows[key].end}
              onChange={(e) =>
                update({ windows: { ...settings.windows, [key]: { ...settings.windows[key], end: e.target.value } } })
              }
              className={`px-2 py-1 ${INPUT}`}
            />
            <button
              onClick={() => removeWindow(key)}
              disabled={Object.keys(settings.windows).length <= 1}
              className="ml-auto rounded-lg bg-rose-500/20 px-2 py-1 text-sm text-rose-600 disabled:opacity-40 dark:text-rose-300"
              aria-label={`Remove ${key}`}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newWindow}
            onChange={(e) => setNewWindow(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWindow()}
            placeholder="New window name, e.g. lunch"
            className={`flex-1 px-2 py-1 text-sm ${INPUT}`}
          />
          <button
            onClick={addWindow}
            disabled={!canAddWindow}
            className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-sm text-slate-500 disabled:opacity-40 dark:border-slate-600 dark:text-slate-400"
          >
            + Add
          </button>
        </div>
        <button
          onClick={() => update({ windows: { ...DEFAULT_WINDOWS } })}
          className="text-xs text-slate-500 underline dark:text-slate-400"
        >
          Reset to defaults (morning, afternoon, evening)
        </button>
      </Section>

      <Section title="Free slots">
        <SliderField
          label="Days on home screen"
          value={settings.freeSlotCount}
          min={0}
          max={10}
          format={(v) => String(v)}
          onChange={(v) => update({ freeSlotCount: v })}
        />
        <SliderField
          label="Spacing window"
          value={settings.isolationWindowDays}
          min={0}
          max={7}
          format={(v) => `± ${v} day${v === 1 ? '' : 's'}`}
          onChange={(v) => update({ isolationWindowDays: v })}
        />
        <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
          Favor weekends
          <input
            type="checkbox"
            checked={settings.favorWeekends}
            onChange={(e) => update({ favorWeekends: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <p className="text-xs text-slate-500">
          Picks prefer days with the most empty calendar within ± this many days, then the most free time, then
          weekends.
        </p>
        <SliderField
          label="Show availability from"
          value={dayStartHour}
          min={0}
          max={24}
          format={(v) => `${String(v).padStart(2, '0')}:00`}
          onChange={(v) => update({ dayStart: `${String(Math.min(23, v)).padStart(2, '0')}:00` })}
        />
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <div className="font-medium">Planning horizon</div>
          <SliderField
            label="Minimum horizon"
            value={settings.minHorizonDays}
            min={7}
            max={settings.maxHorizonDays - 1}
            format={(v) => `${v} days`}
            onChange={(v) => update({ minHorizonDays: Math.min(settings.maxHorizonDays - 1, Math.max(7, v)) })}
          />
          <SliderField
            label="Maximum horizon"
            value={settings.maxHorizonDays}
            min={settings.minHorizonDays + 1}
            max={365}
            format={(v) => `${v} days`}
            onChange={(v) => update({ maxHorizonDays: Math.min(365, Math.max(settings.minHorizonDays + 1, v)) })}
          />
          <p className="text-xs text-slate-500">
            The Free view shows days up to the last event on your horizon calendars, bounded by the min and max above.
            Mark horizon calendars in the Calendars tab.
          </p>
        </div>
        <SliderField
          label="How open must a window be?"
          value={Math.round(settings.freeThreshold * 100)}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => update({ freeThreshold: v / 100 })}
        />
        <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
          All-day events block time
          <input
            type="checkbox"
            checked={settings.blockAllDayEvents}
            onChange={(e) => update({ blockAllDayEvents: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <p className="text-xs text-slate-500">
          Off by default so bill reminders and birthdays don't book your day. Turn it on per calendar with the "All-day"
          pill on the Calendars page, or override individual events with keyword rules on the Metrics page.
        </p>
      </Section>
    </>
  )
}

function MetricsPanel({
  settings,
  update,
  blockingCalendars,
}: {
  settings: Settings
  update: Update
  blockingCalendars: GCalendar[] | null
}) {
  const updateRule = (id: string, patch: Partial<MetricRule>) =>
    update({ metricRules: settings.metricRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  return (
    <Section title="Metric keywords">
      {settings.metricRules.map((rule) => (
        <div key={rule.id} className="space-y-2 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800 dark:shadow-none">
          <div className="flex gap-2">
            <input
              type="text"
              value={rule.icon}
              onChange={(e) => updateRule(rule.id, { icon: e.target.value })}
              className={`w-12 px-2 py-1 text-center text-sm ${INPUT_NESTED}`}
              aria-label="Icon"
            />
            <input
              type="text"
              value={rule.name}
              onChange={(e) => updateRule(rule.id, { name: e.target.value })}
              placeholder="Metric name"
              className={`flex-1 px-2 py-1 text-sm ${INPUT_NESTED}`}
            />
            <button
              onClick={() => update({ metricRules: settings.metricRules.filter((r) => r.id !== rule.id) })}
              className="rounded-lg bg-rose-500/20 px-2 text-sm text-rose-600 dark:text-rose-300"
              aria-label={`Delete ${rule.name}`}
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={rule.keyword}
              onChange={(e) => updateRule(rule.id, { keyword: e.target.value })}
              placeholder="Keywords (comma-separated)"
              className={`flex-1 px-2 py-1 text-sm ${INPUT_NESTED}`}
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={rule.matchDescription}
                onChange={(e) => updateRule(rule.id, { matchDescription: e.target.checked })}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              + description
            </label>
          </div>
          <RuleScope
            rule={rule}
            calendars={blockingCalendars}
            onChange={(calendarIds) => updateRule(rule.id, { calendarIds })}
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={!!rule.blocking}
              onChange={(e) => updateRule(rule.id, { blocking: e.target.checked })}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            Matching events block time (even if marked "Free")
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            All-day matches
            <select
              value={rule.allDay ?? 'inherit'}
              onChange={(e) =>
                updateRule(rule.id, {
                  allDay: e.target.value === 'inherit' ? undefined : (e.target.value as 'block' | 'free'),
                })
              }
              className={`px-2 py-1 ${INPUT_NESTED}`}
            >
              <option value="inherit">Use global setting</option>
              <option value="block">Always block time</option>
              <option value="free">Never block time</option>
            </select>
          </label>
        </div>
      ))}
      <button
        onClick={() =>
          update({
            metricRules: [
              ...settings.metricRules,
              { id: crypto.randomUUID(), name: '', keyword: '', icon: '📌', matchDescription: false },
            ],
          })
        }
        className="w-full rounded-lg border border-dashed border-slate-400 py-2 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400"
      >
        + Add metric
      </button>
    </Section>
  )
}

/** Per-rule "scope" disclosure: which calendars the rule counts on (empty = all). */
function RuleScope({
  rule,
  calendars,
  onChange,
}: {
  rule: MetricRule
  calendars: GCalendar[] | null
  onChange: (calendarIds: string[] | undefined) => void
}) {
  const selected = rule.calendarIds ?? []
  const all = selected.length === 0
  const summary = all
    ? 'All calendars'
    : `${selected.length} calendar${selected.length === 1 ? '' : 's'}`

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]
    onChange(next.length ? next : undefined)
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-slate-500 dark:text-slate-400">
        Scope: <span className="text-slate-700 dark:text-slate-300">{summary}</span>
      </summary>
      <div className="mt-1 space-y-1 pl-1">
        {calendars === null ? (
          <p className="text-slate-500">Loading calendars…</p>
        ) : calendars.length === 0 ? (
          <p className="text-slate-500">Check a blocking calendar on the Calendars page first.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={all}
                onChange={() => onChange(undefined)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300">All calendars</span>
            </label>
            {calendars.map((cal) => (
              <label key={cal.id} className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={selected.includes(cal.id)}
                  onChange={() => toggle(cal.id)}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cal.backgroundColor ?? getColor(getSettings(), 'calendar.fallback') }}
                />
                <span className="text-slate-700 dark:text-slate-300">{cal.summary}</span>
              </label>
            ))}
          </>
        )}
      </div>
    </details>
  )
}

function RelationshipPanel({
  settings,
  update,
  calendars,
}: {
  settings: Settings
  update: Update
  calendars: GCalendar[] | null
}) {
  // Calendars a date can be written to (you must be able to edit them).
  const writable = (calendars ?? []).filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer')
  const targetFallback = settings.jointCalendarIds[0] ?? settings.blockingCalendarIds[0] ?? ''
  return (
    <>
      <Section title="Relationship mode">
        <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
          Enable relationship mode
          <input
            type="checkbox"
            checked={settings.relationshipMode}
            onChange={(e) => update({ relationshipMode: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <p className="text-xs text-slate-500">
          Adds "off days", "overlap", and "date" overlays to the Free tab, plus a partner/joint calendar section on the
          Calendars page.
        </p>
        {settings.relationshipMode && (
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Partner name
            <input
              type="text"
              value={settings.partnerName}
              onChange={(e) => update({ partnerName: e.target.value })}
              placeholder="Partner"
              className={`w-40 px-2 py-1 text-sm ${INPUT}`}
            />
          </label>
        )}
      </Section>

      {settings.relationshipMode && (
        <Section title="Overlap">
          <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
            Overlap threshold (hours)
            <input
              type="number"
              min={0}
              max={24}
              value={settings.overlapMinHours}
              onChange={(e) => update({ overlapMinHours: Math.min(24, Math.max(0, Number(e.target.value) || 0)) })}
              className={`w-20 px-2 py-1 text-right ${INPUT}`}
            />
          </label>
          <p className="text-xs text-slate-500">Minimum shared free time for a day to count toward the "Our Overlap" highlight.</p>
        </Section>
      )}

      {settings.relationshipMode && (
        <Section title="Date picking">
          <p className="text-xs text-slate-500">How the ❤️ date candidates are chosen and ranked.</p>
          <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
            Minimum date length (hours)
            <input
              type="number"
              min={0}
              max={24}
              value={settings.dateMinHours}
              onChange={(e) => update({ dateMinHours: Math.min(24, Math.max(0, Number(e.target.value) || 0)) })}
              className={`w-20 px-2 py-1 text-right ${INPUT}`}
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
            Date candidates to show
            <input
              type="number"
              min={1}
              max={10}
              value={settings.dateCandidateCount}
              onChange={(e) => update({ dateCandidateCount: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
              className={`w-20 px-2 py-1 text-right ${INPUT}`}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Prefer days {settings.partnerName || 'partner'} is off work
            <input
              type="checkbox"
              checked={settings.dateFavorPartnerOff}
              onChange={(e) => update({ dateFavorPartnerOff: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Favor times {settings.partnerName || 'partner'} is busy for my Top picks
            <input
              type="checkbox"
              checked={settings.freeFavorPartnerBusy}
              onChange={(e) => update({ freeFavorPartnerBusy: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <p className="text-xs text-slate-500">
            Nudges the ★ Top free-day picks toward windows {settings.partnerName || 'partner'} is already busy,
            so your shared-free time stays open. Soft tiebreaker — it never overrides a clearly more open day.
          </p>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Day preference
            <select
              value={settings.datePreference}
              onChange={(e) => update({ datePreference: e.target.value as Settings['datePreference'] })}
              className={`px-2 py-1 ${INPUT}`}
            >
              <option value="weekend">Prefer weekends</option>
              <option value="weekday">Prefer weekdays</option>
              <option value="either">No preference</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            "Date" events come from
            <select
              value={resolveDateRule(settings.metricRules, settings.dateRuleId)?.id ?? ''}
              onChange={(e) => update({ dateRuleId: e.target.value })}
              className={`px-2 py-1 ${INPUT}`}
            >
              {settings.metricRules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.name || r.keyword || r.id}
                </option>
              ))}
            </select>
          </label>
          <RankPriority settings={settings} update={update} />
          <p className="text-xs text-slate-500">
            Candidates are ranked by the priority above (drag-free reorder with the arrows), one per week, never
            back-to-back. A week that already has a matching event is skipped (edit keyword rules on the Metrics page).
          </p>
        </Section>
      )}

      {settings.relationshipMode && (
        <Section title="Cadence">
          <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
            Nudge when overdue (days, 0 = off)
            <input
              type="number"
              min={0}
              max={365}
              value={settings.dateCadenceDays}
              onChange={(e) => update({ dateCadenceDays: Math.min(365, Math.max(0, Number(e.target.value) || 0)) })}
              className={`w-20 px-2 py-1 text-right ${INPUT}`}
            />
          </label>
        </Section>
      )}

      {settings.relationshipMode && (
        <Section title="Book a date">
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Add dates to
            <select
              value={settings.dateTargetCalendarId || targetFallback}
              onChange={(e) => update({ dateTargetCalendarId: e.target.value })}
              className={`max-w-[60%] truncate px-2 py-1 ${INPUT}`}
            >
              {writable.length === 0 && <option value="">(sign in to pick a calendar)</option>}
              {writable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Event title
            <input
              type="text"
              value={settings.dateEventTitle}
              onChange={(e) => update({ dateEventTitle: e.target.value })}
              placeholder="Date ❤️"
              className={`w-44 px-2 py-1 text-sm ${INPUT}`}
            />
          </label>
          <p className="text-xs text-slate-500">
            "Plan date" on a day creates a {settings.dateMinHours}h event in your shared free window. Keep a date keyword
            in the title so that week stops being suggested. Booking needs calendar write access — if it fails, sign out
            and back in on the Account page to grant it.
          </p>
        </Section>
      )}
    </>
  )
}

/** Reorderable list that sets the date-ranking factor precedence. */
function RankPriority({ settings, update }: { settings: Settings; update: Update }) {
  const order = normalizeRankOrder(settings.dateRankOrder)
  const partner = settings.partnerName || 'Partner'
  const labels: Record<DateRankFactor, string> = {
    partnerOff: `${partner}'s days off`,
    isolation: 'Most open calendar (spacing)',
    dayType: 'Day preference',
    overlap: 'Most shared free time',
  }
  // Factors whose own control is currently off contribute nothing wherever they sit.
  const inactive: Record<DateRankFactor, boolean> = {
    partnerOff: !settings.dateFavorPartnerOff,
    isolation: settings.isolationWindowDays <= 0,
    dayType: settings.datePreference === 'either',
    overlap: false,
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    update({ dateRankOrder: next })
  }
  return (
    <div className="space-y-1">
      <span className="text-sm text-slate-700 dark:text-slate-300">Ranking priority</span>
      {order.map((f, i) => (
        <div
          key={f}
          className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm shadow-sm dark:bg-slate-800 dark:shadow-none"
        >
          <span className="w-4 text-center text-xs text-slate-400">{i + 1}</span>
          <span className="flex-1 text-slate-700 dark:text-slate-300">
            {labels[f]}
            {inactive[f] && <span className="ml-1 text-xs text-slate-400">· off</span>}
          </span>
          <button
            onClick={() => move(i, -1)}
            disabled={i === 0}
            aria-label={`Move ${labels[f]} up`}
            className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            ↑
          </button>
          <button
            onClick={() => move(i, 1)}
            disabled={i === order.length - 1}
            aria-label={`Move ${labels[f]} down`}
            className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            ↓
          </button>
        </div>
      ))}
    </div>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-300">
      {label && (
        <div className="flex items-center justify-between">
          <span>{label}</span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">{format(value)}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-1 w-full accent-emerald-500"
        />
        {!label && (
          <span className="mt-1 w-20 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">
            {format(value)}
          </span>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
