import { useEffect, useState } from 'react'
import { hasEverSignedIn, signIn, signOut } from '../auth/google'
import { listCalendars, type GCalendar } from '../api/calendar'
import { DEFAULT_WINDOWS, windowKeys } from '../lib/availability'
import { useSettings, type MetricRule } from '../store/settings'
import { ErrorBanner } from '../components/Banner'

const INPUT =
  'rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
const INPUT_NESTED =
  'rounded-lg border border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'

export default function SettingsPage() {
  const [settings, update] = useSettings()
  const [signedIn, setSignedIn] = useState(hasEverSignedIn())
  const [calendars, setCalendars] = useState<GCalendar[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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

  const toggleIn = (field: 'blockingCalendarIds' | 'workCalendarIds' | 'holidayCalendarIds', id: string) => {
    const cur = settings[field]
    update({ [field]: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id] })
  }

  const blockingCalendars = calendars?.filter((c) => settings.blockingCalendarIds.includes(c.id)) ?? null

  const updateRule = (id: string, patch: Partial<MetricRule>) =>
    update({ metricRules: settings.metricRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  return (
    <div className="space-y-6 lg:columns-2 lg:gap-6 lg:space-y-0">
      <h1 className="text-xl font-bold lg:mb-6 lg:break-inside-avoid">Settings</h1>
      {error && <ErrorBanner message={error} />}

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
            onClick={handleSignOut}
            className="w-full rounded-lg bg-slate-300 py-2 text-sm font-medium dark:bg-slate-700"
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={busy || !settings.clientId}
            className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-emerald-950 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>
        )}
      </Section>

      {signedIn && (
        <>
          <Section title="Calendars that block your time">
            <CalendarChecklist
              calendars={calendars}
              checked={settings.blockingCalendarIds}
              onToggle={(id) => toggleIn('blockingCalendarIds', id)}
            />
            <p className="text-xs text-slate-500">
              Leave bill-reminder calendars unchecked — though all-day events never block time either way.
            </p>
          </Section>

          <Section title="Work calendars">
            {blockingCalendars && blockingCalendars.length === 0 ? (
              <p className="text-xs text-slate-500">Check a calendar above first to mark it as work.</p>
            ) : (
              <CalendarChecklist
                calendars={blockingCalendars}
                checked={settings.workCalendarIds}
                onToggle={(id) => toggleIn('workCalendarIds', id)}
              />
            )}
            <p className="text-xs text-slate-500">
              On the Free tab, work events don't count as "partly booked" — an evening with only work on it shows "free
              after work" instead. (Work still blocks time on the Check tab.)
            </p>
          </Section>

          <Section title="Holiday calendars">
            <CalendarChecklist
              calendars={calendars}
              checked={settings.holidayCalendarIds}
              onToggle={(id) => toggleIn('holidayCalendarIds', id)}
            />
            <p className="text-xs text-slate-500">
              Free slots near these calendars' events get a note like "2 days before Memorial Day". Tip: subscribe to
              "Holidays in United States" in Google Calendar and check it here.
            </p>
          </Section>
        </>
      )}

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
          below.
        </p>
      </Section>

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
    </div>
  )
}

function CalendarChecklist({
  calendars,
  checked,
  onToggle,
}: {
  calendars: GCalendar[] | null
  checked: string[]
  onToggle: (id: string) => void
}) {
  if (!calendars) return <p className="text-sm text-slate-500">Loading calendars…</p>
  return (
    <>
      {calendars.map((cal) => (
        <label key={cal.id} className="flex items-center gap-3 py-1 text-sm">
          <input
            type="checkbox"
            checked={checked.includes(cal.id)}
            onChange={() => onToggle(cal.id)}
            className="h-4 w-4 accent-emerald-500"
          />
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: cal.backgroundColor ?? '#64748b' }}
          />
          <span className="text-slate-800 dark:text-slate-200">{cal.summary}</span>
        </label>
      ))}
    </>
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
          <p className="text-slate-500">Check a blocking calendar above first.</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 lg:mb-6 lg:break-inside-avoid">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{title}</h2>
      {children}
    </section>
  )
}
