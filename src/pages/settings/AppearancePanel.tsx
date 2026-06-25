import Section from '../../components/Section'
import TokenField from '../../components/TokenField'
import { TOKEN_GROUPS, getToken } from '../../lib/designTokens'
import type { Settings } from '../../store/settings'
import type { Update } from './shared'

export default function AppearancePanel({ settings, update }: { settings: Settings; update: Update }) {
  const setToken = (key: string, value: string) =>
    update({ tokens: { ...settings.tokens, [key]: value } })
  const resetToken = (key: string) => {
    const { [key]: _, ...rest } = settings.tokens
    update({ tokens: rest })
  }
  const resetGroup = (keys: string[]) => {
    const rest = { ...settings.tokens }
    for (const k of keys) delete rest[k]
    update({ tokens: rest })
  }
  const groupHasOverrides = (keys: string[]) => keys.some((k) => k in settings.tokens)
  const hasOverrides = Object.keys(settings.tokens).length > 0

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <Section title="Appearance" className="xl:col-span-2">
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ theme: mode })}
              className={`flex-1 rounded-lg py-2 text-sm capitalize ${
                settings.theme === mode
                  ? 'bg-emerald-500 font-medium text-emerald-950'
                  : 'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {mode === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>
          ))}
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3 xl:col-span-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Design tokens
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live controls for every CSS variable the app theme is built from.
          </p>
        </div>
        {hasOverrides && (
          <button
            onClick={() => update({ tokens: {} })}
            className="shrink-0 rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm text-rose-600 dark:text-rose-400"
          >
            Reset all
          </button>
        )}
      </div>

      {TOKEN_GROUPS.map((group) => {
        const keys = group.entries.map((e) => e.key)
        return (
          <Section
            key={group.id}
            title={group.title}
            action={
              groupHasOverrides(keys) && (
                <button
                  onClick={() => resetGroup(keys)}
                  className="text-xs text-slate-500 underline dark:text-slate-400"
                >
                  Reset group
                </button>
              )
            }
          >
            {group.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{group.description}</p>
            )}
            <div className="rounded-lg bg-slate-50 px-3 py-1 dark:bg-slate-900">
              {group.entries.map((entry) => (
                <TokenField
                  key={entry.key}
                  entry={entry}
                  value={getToken(settings, entry.key)}
                  onChange={(value) => setToken(entry.key, value)}
                  onReset={() => resetToken(entry.key)}
                />
              ))}
            </div>
          </Section>
        )
      })}
    </div>
  )
}
