import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * App-level error boundary. A render crash anywhere below it swaps the page
 * content for a recovery panel instead of a white screen. Mounted inside
 * `<main>` in App.tsx so the nav survives and the user can still reach other
 * tabs. React still requires a class component for `componentDidCatch`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  resetSettings = (): void => {
    // Corrupted settings are the most common self-inflicted crash class; clear
    // them and reload so loadSettings falls back to DEFAULT_SETTINGS.
    if (!confirm('Reset all scheddy settings? This clears your calendar picks and preferences.')) return
    localStorage.removeItem('scheddy.settings')
    location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto max-w-lg rounded-lg border border-rose-400/60 bg-rose-500/10 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/40 dark:text-rose-300">
        <p className="font-bold">Something broke.</p>
        <p className="mt-1 break-words">{error.message || 'An unexpected error occurred.'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-lg bg-rose-600 px-3 py-2 font-bold text-white hover:bg-rose-700"
          >
            Reload app
          </button>
          <button
            type="button"
            onClick={this.resetSettings}
            className="rounded-lg border border-rose-400/60 px-3 py-2 font-bold text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
          >
            Reset settings
          </button>
        </div>
      </div>
    )
  }
}
