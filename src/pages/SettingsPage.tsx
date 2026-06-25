import { useEffect, useState } from 'react'
import { hasEverSignedIn, signIn, signOut } from '../auth/google'
import { listCalendars, type GCalendar } from '../api/calendar'
import { useSettings } from '../store/settings'
import { ErrorBanner } from '../components/Banner'
import AccountPanel from './settings/AccountPanel'
import AppearancePanel from './settings/AppearancePanel'
import CalendarsPanel from './settings/CalendarsPanel'
import AvailabilityPanel from './settings/AvailabilityPanel'
import MetricsPanel from './settings/MetricsPanel'
import RelationshipPanel from './settings/RelationshipPanel'

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
  { key: 'availability', label: 'Scheduler', icon: '🕐' },
  { key: 'metrics', label: 'Metrics', icon: '📌' },
  { key: 'relationship', label: 'Relationship', icon: '💑' },
]

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
        <nav className="w-56 shrink-0 space-y-1">
          <h1 className="mb-4 text-xl font-bold">Settings</h1>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
                desktopActive === c.key
                  ? 'bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 hover:bg-slate-500/5 dark:text-slate-400'
              }`}
            >
              <span className="text-lg leading-none">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-5">
          {error && <ErrorBanner message={error} />}
          {renderPanel(desktopActive)}
        </div>
      </div>
    </div>
  )
}
