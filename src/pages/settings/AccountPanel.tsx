import Section from '../../components/Section'
import type { Settings } from '../../store/settings'
import { INPUT, type Update } from './shared'

export default function AccountPanel({
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
