import { useEffect, useState } from 'react'
import { hasEverSignedIn, signIn, signOut } from '../auth/google'
import { listCalendars, type GCalendar } from '../api/calendar'
import { DEFAULT_WINDOWS, windowKeys } from '../lib/availability'
import { useSettings, type MetricRule, type Settings } from '../store/settings'
import { ErrorBanner } from '../components/Banner'

const INPUT =
  'rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
const INPUT_NESTED =
  'rounded-lg border border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'

type CatKey = 'account' | 'appearance' | 'calendars' | 'availability' | 'metrics' | 'relationship'

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
        return <RelationshipPanel settings={settings} update={update} />
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

function AppearancePanel({ settings, update }: { settings: Settings; update: Update }) {
  return (
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
  )
}

function CalendarsPanel({
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

  if (!signedIn) {
    return <p className="text-sm text-slate-500">Sign in on the Account page first to pick calendars.</p>
  }
  if (!calendars) return <p className="text-sm text-slate-500">Loading calendars…</p>

  const has = (field: 'blockingCalendarIds' | 'workCalendarIds' | 'holidayCalendarIds', id: string) =>
    settings[field].includes(id)

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

  const toggleHoliday = (id: string) =>
    update({
      holidayCalendarIds: has('holidayCalendarIds', id)
        ? settings.holidayCalendarIds.filter((x) => x !== id)
        : [...settings.holidayCalendarIds, id],
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

  // Partner "work" ⊆ partner "blocks time", mirroring the personal calendars above.
  const togglePartnerBlocking = (id: string) => {
    if (hasIn('partnerBlockingCalendarIds', id)) {
      update({
        partnerBlockingCalendarIds: settings.partnerBlockingCalendarIds.filter((x) => x !== id),
        partnerWorkCalendarIds: settings.partnerWorkCalendarIds.filter((x) => x !== id),
      })
    } else {
      update({ partnerBlockingCalendarIds: [...settings.partnerBlockingCalendarIds, id] })
    }
  }

  const togglePartnerWork = (id: string) => {
    if (!hasIn('partnerBlockingCalendarIds', id)) return
    toggleIn('partnerWorkCalendarIds', id)
  }

  const q = query.trim().toLowerCase()
  const shown = q ? calendars.filter((c) => c.summary.toLowerCase().includes(q)) : calendars

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
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {shown.map((cal) => {
            const blocking = has('blockingCalendarIds', cal.id)
            return (
              <div
                key={cal.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2.5 shadow-sm dark:bg-slate-800 dark:shadow-none"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: cal.backgroundColor ?? '#64748b' }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">
                  {cal.summary}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  <RolePill active={blocking} onClick={() => toggleBlocking(cal.id)}>
                    Blocks time
                  </RolePill>
                  <RolePill active={has('workCalendarIds', cal.id)} disabled={!blocking} onClick={() => toggleWork(cal.id)}>
                    Work
                  </RolePill>
                  <RolePill active={has('holidayCalendarIds', cal.id)} onClick={() => toggleHoliday(cal.id)}>
                    Holiday
                  </RolePill>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="space-y-1 pt-1 text-xs text-slate-500">
        <p>
          <strong className="text-slate-600 dark:text-slate-400">Blocks time</strong> — events here mark you busy.
        </p>
        <p>
          <strong className="text-slate-600 dark:text-slate-400">Work</strong> — still busy, but evenings with only work
          read "free after work" on the Free tab (needs Blocks time).
        </p>
        <p>
          <strong className="text-slate-600 dark:text-slate-400">Holiday</strong> — adds notes like "2 days before
          Memorial Day". Tip: subscribe to "Holidays in United States" in Google Calendar.
        </p>
      </div>

      {settings.relationshipMode && (
        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Partner & joint calendars</h3>
          {shown.length === 0 ? (
            <p className="text-sm text-slate-500">No calendars match "{query}".</p>
          ) : (
            <div className="max-h-[60vh] space-y-1 overflow-y-auto">
              {shown.map((cal) => {
                const pBlocking = hasIn('partnerBlockingCalendarIds', cal.id)
                return (
                  <div
                    key={cal.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2.5 shadow-sm dark:bg-slate-800 dark:shadow-none"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cal.backgroundColor ?? '#64748b' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">
                      {cal.summary}
                    </span>
                    <div className="flex shrink-0 gap-1.5">
                      <RolePill active={pBlocking} onClick={() => togglePartnerBlocking(cal.id)}>
                        Partner busy
                      </RolePill>
                      <RolePill active={hasIn('partnerWorkCalendarIds', cal.id)} disabled={!pBlocking} onClick={() => togglePartnerWork(cal.id)}>
                        Partner work
                      </RolePill>
                      <RolePill active={hasIn('jointCalendarIds', cal.id)} onClick={() => toggleIn('jointCalendarIds', cal.id)}>
                        Joint
                      </RolePill>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="space-y-1 pt-1 text-xs text-slate-500">
            <p>
              <strong className="text-slate-600 dark:text-slate-400">Partner busy</strong> — your partner's calendars;
              used to find mutual free time and space out date picks.
            </p>
            <p>
              <strong className="text-slate-600 dark:text-slate-400">Partner work</strong> — drives the "off work"
              overlay on the Free tab (needs Partner busy).
            </p>
            <p>
              <strong className="text-slate-600 dark:text-slate-400">Joint</strong> — shared events that block both of
              you (e.g. a couples calendar).
            </p>
          </div>
        </div>
      )}
    </Section>
  )
}

function RolePill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        active
          ? 'border-emerald-500 bg-emerald-500 text-emerald-950'
          : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      {children}
    </button>
  )
}

function AvailabilityPanel({ settings, update }: { settings: Settings; update: Update }) {
  const [newWindow, setNewWindow] = useState('')

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
        <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
          Days on home screen
          <input
            type="number"
            min={1}
            max={30}
            value={settings.freeSlotCount}
            onChange={(e) => update({ freeSlotCount: Math.max(1, Number(e.target.value) || 1) })}
            className={`w-20 px-2 py-1 text-right ${INPUT}`}
          />
        </label>
        <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
          Spacing window (± days)
          <input
            type="number"
            min={0}
            max={14}
            value={settings.isolationWindowDays}
            onChange={(e) => update({ isolationWindowDays: Math.min(14, Math.max(0, Number(e.target.value) || 0)) })}
            className={`w-20 px-2 py-1 text-right ${INPUT}`}
          />
        </label>
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
        <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
          Show availability from
          <input
            type="time"
            value={settings.dayStart}
            onChange={(e) => update({ dayStart: e.target.value || '08:00' })}
            className={`px-2 py-1 ${INPUT}`}
          />
        </label>
        <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
          Calendar span (days)
          <input
            type="number"
            min={7}
            max={365}
            value={settings.lookaheadDays}
            onChange={(e) => update({ lookaheadDays: Math.min(365, Math.max(7, Number(e.target.value) || 60)) })}
            className={`w-20 px-2 py-1 text-right ${INPUT}`}
          />
        </label>
        <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
          How open must a window be?
          <select
            value={String(settings.freeThreshold)}
            onChange={(e) => update({ freeThreshold: Number(e.target.value) })}
            className={`px-2 py-1 ${INPUT}`}
          >
            <option value="0.5">≥ 50%</option>
            <option value="0.75">≥ 75%</option>
            <option value="1">Fully free</option>
          </select>
        </label>
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
          Off by default so bill reminders and birthdays don't book your day. Individual keyword rules can override this
          on the Metrics page.
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
                  style={{ backgroundColor: cal.backgroundColor ?? '#64748b' }}
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

function RelationshipPanel({ settings, update }: { settings: Settings; update: Update }) {
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
        <Section title="Date options">
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
              value={settings.dateRuleId}
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
          <p className="text-xs text-slate-500">
            A week that already has a matching event won't be offered as a date candidate. Add or edit keyword rules on
            the Metrics page.
          </p>
        </Section>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{title}</h2>
      {children}
    </section>
  )
}
