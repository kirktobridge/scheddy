import { useState } from 'react'
import FreePage from './pages/FreePage'
import CheckPage from './pages/CheckPage'
import MetricsPage from './pages/MetricsPage'
import SettingsPage from './pages/SettingsPage'

type Tab = 'free' | 'check' | 'metrics' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'free', label: 'Free', icon: '🕐' },
  { id: 'check', label: 'Check', icon: '🔍' },
  { id: 'metrics', label: 'Metrics', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('free')

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {tab === 'free' && <FreePage />}
        {tab === 'check' && <CheckPage />}
        {tab === 'metrics' && <MetricsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-700 bg-slate-800/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                tab === t.id ? 'text-emerald-400' : 'text-slate-400'
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
