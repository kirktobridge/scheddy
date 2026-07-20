import { QUERY_PRESETS, type QueryState } from '../hooks/useQueryMode'
import type { WindowKey } from '../lib/availability'

interface Props {
  query: QueryState
  /** Ordered window names for the per-window filter chips. */
  winKeys: WindowKey[]
  /** Relationship mode on — surfaces the "Both of us" mutual-availability chip. */
  rel: boolean
}

const ON = 'bg-emerald-500 font-medium text-emerald-950'
const OFF =
  'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'

/**
 * Query lens for the Free canvas (B-24) — the controls that used to be CheckPage,
 * mounted in FreeCalendar's headerSlot. Idle by default; picking a preset / month /
 * custom range activates the query, which the page reflects on the canvas and in
 * the left rail. "Both of us" (relationship mode) scopes results to mutual-free time.
 */
export default function QueryModeBar({ query, winKeys, rel }: Props) {
  const { mode, active } = query
  const chip = (on: boolean) => `rounded-full px-2.5 py-1 text-xs transition ${on ? ON : OFF}`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold tracking-wide text-slate-400 dark:text-slate-500">
          When are we free?
        </span>
        {QUERY_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => query.setPreset(p.id)}
            className={chip(mode.kind === 'preset' && mode.preset === p.id)}
          >
            {p.label}
          </button>
        ))}
        {query.monthOptions.length > 0 && (
          <select
            value={mode.kind === 'month' ? mode.iso : ''}
            onChange={(e) => e.target.value && query.setMonth(e.target.value)}
            className={chip(mode.kind === 'month')}
          >
            <option value="">Month…</option>
            {query.monthOptions.map((m) => (
              <option key={m.iso} value={m.iso}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={query.setCustom} className={chip(mode.kind === 'custom')}>
          Custom…
        </button>
        {rel && (
          <button
            type="button"
            onClick={() => query.setBothOfUs(!query.bothOfUs)}
            className={chip(query.bothOfUs)}
            aria-pressed={query.bothOfUs}
          >
            ❤️ Both of us
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={query.clear}
            title="Clear query (Esc)"
            className="ml-auto rounded-full px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {mode.kind === 'custom' && (
        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={query.customStart}
            onChange={(e) => query.setCustomStart(e.target.value)}
            aria-label="Range start"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={query.customEnd}
            onChange={(e) => query.setCustomEnd(e.target.value)}
            aria-label="Range end"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
      )}

      {active && (
        <div className="flex flex-wrap gap-1.5">
          {winKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => query.toggleWindow(key)}
              className={`rounded-full px-2 py-0.5 text-xs capitalize transition ${
                query.windowFilter.includes(key)
                  ? 'bg-slate-300 font-medium text-slate-900 dark:bg-slate-600 dark:text-slate-100'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
