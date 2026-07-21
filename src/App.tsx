import { useCallback, useEffect, useState } from 'react'
import FreePage from './pages/FreePage'
import SettingsPage from './pages/SettingsPage'
import { useSettings } from './store/settings'
import { applyTokenVars } from './lib/designTokens'
import { ErrorBoundary } from './components/ErrorBoundary'
import CornerControls from './components/CornerControls'

type Tab = 'free' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('free')
  const [refreshTick, setRefreshTick] = useState(0)
  // Data status published by FreePage, so the corner refresh control can double
  // as the staleness indicator (B-27 replaced the nav that used to host it).
  const [busy, setBusy] = useState(false)
  const handleStatus = useCallback(
    ({ loading, stale }: { loading: boolean; stale: boolean }) => setBusy(loading || stale),
    [],
  )
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
      <main className="flex-1 overflow-y-auto px-4 pt-2 pb-8 lg:px-8 lg:pt-3">
        <div className="w-full">
          <CornerControls
            settingsOpen={tab === 'settings'}
            onSettings={() => setTab((t) => (t === 'settings' ? 'free' : 'settings'))}
            onRefresh={() => setRefreshTick((t) => t + 1)}
            busy={busy}
          />
          {/* key={tab} remounts the boundary on tab change, so a crash on one
              tab doesn't strand the other — the corner controls are the escape. */}
          <ErrorBoundary key={tab}>
            {tab === 'free' && <FreePage refreshTick={refreshTick} onStatus={handleStatus} />}
            {tab === 'settings' && <SettingsPage />}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
