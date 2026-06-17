import { useEffect, useState } from 'react'
import FreePage from './pages/FreePage'
import CheckPage from './pages/CheckPage'
import SettingsPage from './pages/SettingsPage'
import { useSettings } from './store/settings'
import { applyTokenVars } from './lib/designTokens'

type Tab = 'free' | 'check' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'free', label: 'Free', icon: '🕐' },
  { id: 'check', label: 'Check', icon: '🔍' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('free')
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
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24 lg:px-8 lg:pb-8 lg:pt-8">
        <div className="w-full">
          {tab === 'free' && <FreePage />}
          {tab === 'check' && <CheckPage />}
          {tab === 'settings' && <SettingsPage />}
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-300 bg-white/95 backdrop-blur lg:static lg:order-first lg:h-dvh lg:w-56 lg:shrink-0 lg:border-t-0 lg:border-r dark:border-slate-700 dark:bg-slate-800/95">
        <div className="mx-auto flex max-w-lg lg:max-w-none lg:flex-col lg:gap-1 lg:p-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="hidden px-3 py-4 text-lg font-bold lg:block">🗓️ scheddy</div>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-lg lg:px-3 lg:py-2.5 lg:text-sm ${
                tab === t.id
                  ? 'text-emerald-600 lg:bg-emerald-500/10 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
