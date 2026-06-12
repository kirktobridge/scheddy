import { useEffect, useState } from 'react'
import { hasEverSignedIn, signIn, signOut } from '../auth/google'
import { listCalendars, type GCalendar } from '../api/calendar'
import { WINDOW_KEYS } from '../lib/availability'
import { useSettings, type MetricRule } from '../store/settings'
import { ErrorBanner } from '../components/Banner'

export default function SettingsPage() {
  const [settings, update] = useSettings()
  const [signedIn, setSignedIn] = useState(hasEverSignedIn())
  const [calendars, setCalendars] = useState<GCalendar[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const toggleCalendar = (id: string) => {
    const cur = settings.blockingCalendarIds
    update({ blockingCalendarIds: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id] })
  }

  const updateRule = (id: string, patch: Partial<MetricRule>) =>
    update({ metricRules: settings.metricRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>
      {error && <ErrorBanner message={error} />}

      <Section title="Google account">
        <label className="block text-sm text-slate-400">
          OAuth Client ID
          <input
            type="text"
            value={settings.clientId}
            onChange={(e) => update({ clientId: e.target.value.trim() })}
            placeholder="xxxxx.apps.googleusercontent.com"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
          />
        </label>
        {signedIn ? (
          <button onClick={handleSignOut} className="w-full rounded-lg bg-slate-700 py-2 text-sm font-medium">
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
        <Section title="Calendars that block your time">
          {!calendars && <p className="text-sm text-slate-500">Loading calendars…</p>}
          {calendars?.map((cal) => (
            <label key={cal.id} className="flex items-center gap-3 py-1 text-sm">
              <input
                type="checkbox"
                checked={settings.blockingCalendarIds.includes(cal.id)}
                onChange={() => toggleCalendar(cal.id)}
                className="h-4 w-4 accent-emerald-500"
              />
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: cal.backgroundColor ?? '#64748b' }}
              />
              <span className="text-slate-200">{cal.summary}</span>
            </label>
          ))}
          <p className="text-xs text-slate-500">
            Leave bill-reminder calendars unchecked — though all-day events never block time either way.
          </p>
        </Section>
      )}

      <Section title="Time windows">
        {WINDOW_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className="w-20 capitalize text-slate-300">{key}</span>
            <input
              type="time"
              value={settings.windows[key].start}
              onChange={(e) =>
                update({ windows: { ...settings.windows, [key]: { ...settings.windows[key], start: e.target.value } } })
              }
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200"
            />
            <span className="text-slate-500">–</span>
            <input
              type="time"
              value={settings.windows[key].end}
              onChange={(e) =>
                update({ windows: { ...settings.windows, [key]: { ...settings.windows[key], end: e.target.value } } })
              }
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200"
            />
          </div>
        ))}
      </Section>

      <Section title="Free slots">
        <label className="flex items-center justify-between text-sm text-slate-300">
          Slots on home screen
          <input
            type="number"
            min={1}
            max={30}
            value={settings.freeSlotCount}
            onChange={(e) => update({ freeSlotCount: Math.max(1, Number(e.target.value) || 1) })}
            className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-right text-slate-200"
          />
        </label>
        <label className="flex items-center justify-between text-sm text-slate-300">
          How open must a window be?
          <select
            value={String(settings.freeThreshold)}
            onChange={(e) => update({ freeThreshold: Number(e.target.value) })}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200"
          >
            <option value="0.5">≥ 50%</option>
            <option value="0.75">≥ 75%</option>
            <option value="1">Fully free</option>
          </select>
        </label>
      </Section>

      <Section title="Metric keywords">
        {settings.metricRules.map((rule) => (
          <div key={rule.id} className="space-y-2 rounded-lg bg-slate-800 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={rule.icon}
                onChange={(e) => updateRule(rule.id, { icon: e.target.value })}
                className="w-12 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center text-sm"
                aria-label="Icon"
              />
              <input
                type="text"
                value={rule.name}
                onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                placeholder="Metric name"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
              />
              <button
                onClick={() => update({ metricRules: settings.metricRules.filter((r) => r.id !== rule.id) })}
                className="rounded-lg bg-rose-500/20 px-2 text-sm text-rose-300"
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
                placeholder="Keyword in event title"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={rule.matchDescription}
                  onChange={(e) => updateRule(rule.id, { matchDescription: e.target.checked })}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                + description
              </label>
            </div>
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
          className="w-full rounded-lg border border-dashed border-slate-600 py-2 text-sm text-slate-400"
        >
          + Add metric
        </button>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">{title}</h2>
      {children}
    </section>
  )
}
