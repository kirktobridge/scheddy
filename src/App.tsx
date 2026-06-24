import { useEffect, useState } from 'react'
import FreePage from './pages/FreePage'
import CheckPage from './pages/CheckPage'
import SettingsPage from './pages/SettingsPage'
import { useSettings } from './store/settings'
import { applyTokenVars } from './lib/designTokens'

type Tab = 'free' | 'check' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'free', label: 'Scheduler', icon: '🕐' },
  { id: 'check', label: 'Check', icon: '🔍' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('free')
  const [refreshTick, setRefreshTick] = useState(0)
  const [navOpen, setNavOpen] = useState(false)
  const [settings] = useSettings()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', settings.theme === 'dark' ? '#0f172a' : '#f1f5f9')
  }, [settings.theme])

  useEffect(() => {
    applyTokenVars(settings)
  }, [settings.tokens])

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24 lg:px-8 lg:pb-8 lg:pt-6">
        <div className="w-full">
          {tab === 'free' && <FreePage refreshTick={refreshTick} />}
          {tab === 'check' && <CheckPage />}
          {tab === 'settings' && <SettingsPage />}
        </div>
      </main>

      {/* Desktop: auto-hiding top nav. Hidden by default behind a thin chevron
          cue; slides down while the top edge is hovered. */}
      <div className="fixed inset-x-0 top-0 z-50 hidden lg:block">
        <div onMouseEnter={() => setNavOpen(true)} className="flex justify-center">
          <button
            type="button"
            aria-label={navOpen ? 'Hide menu' : 'Show menu'}
            onClick={() => setNavOpen((o) => !o)}
            className="rounded-b-md border border-t-0 border-slate-300 bg-white/90 px-5 pb-0.5 text-sm leading-none text-slate-400 shadow-sm backdrop-blur hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-500"
          >
            ⌄
          </button>
        </div>
        <nav
          onMouseEnter={() => setNavOpen(true)}
          onMouseLeave={() => setNavOpen(false)}
          className={`absolute inset-x-0 top-0 flex items-center gap-3 border-b border-slate-300 bg-white/95 px-6 py-2 shadow-sm backdrop-blur transition-transform duration-200 dark:border-slate-700 dark:bg-slate-800/95 ${
            navOpen ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <div className="mr-2 text-lg font-bold">🗓️ scheddy</div>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                tab === t.id
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
          {tab === 'free' && (
            <button
              onClick={() => setRefreshTick((t) => t + 1)}
              title="Reload calendars"
              className="ml-auto flex items-center gap-2 rounded-lg bg-slate-200 px-3 py-2 text-sm font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200"
            >
              <span className="text-base leading-none">↻</span>
              Refresh
            </button>
          )}
        </nav>
      </div>

      {/* Mobile: frozen bottom tab bar (deprecated narrow layout). */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-300 bg-white/95 backdrop-blur lg:hidden dark:border-slate-700 dark:bg-slate-800/95">
        <div className="mx-auto flex max-w-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                tab === t.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
          {tab === 'free' && (
            <button
              onClick={() => setRefreshTick((t) => t + 1)}
              title="Reload calendars"
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-slate-500 dark:text-slate-400"
            >
              <span className="text-xl leading-none">↻</span>
              Refresh
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}
