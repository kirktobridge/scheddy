import type { GCalendar } from '../../api/calendar'
import Section from '../../components/Section'
import { getColor } from '../../lib/designTokens'
import type { MetricRule, Settings } from '../../store/settings'
import { INPUT_NESTED, type Update } from './shared'

export default function MetricsPanel({
  settings,
  update,
  blockingCalendars,
}: {
  settings: Settings
  update: Update
  blockingCalendars: GCalendar[] | null
}) {
  const updateRule = (id: string, patch: Partial<MetricRule>) =>
    update({ metricRules: settings.metricRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  return (
    <Section title="Metric keywords">
      {settings.metricRules.map((rule) => (
        <div key={rule.id} className="space-y-2 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800 dark:shadow-none">
          <div className="flex gap-2">
            <input
              type="text"
              value={rule.icon}
              onChange={(e) => updateRule(rule.id, { icon: e.target.value })}
              className={`w-12 px-2 py-1 text-center text-sm ${INPUT_NESTED}`}
              aria-label="Icon"
            />
            <input
              type="text"
              value={rule.name}
              onChange={(e) => updateRule(rule.id, { name: e.target.value })}
              placeholder="Metric name"
              className={`flex-1 px-2 py-1 text-sm ${INPUT_NESTED}`}
            />
            <button
              onClick={() => update({ metricRules: settings.metricRules.filter((r) => r.id !== rule.id) })}
              className="rounded-lg bg-rose-500/20 px-2 text-sm text-rose-600 dark:text-rose-300"
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
              placeholder="Keywords (comma-separated)"
              className={`flex-1 px-2 py-1 text-sm ${INPUT_NESTED}`}
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={rule.matchDescription}
                onChange={(e) => updateRule(rule.id, { matchDescription: e.target.checked })}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              + description
            </label>
          </div>
          <RuleScope
            rule={rule}
            calendars={blockingCalendars}
            settings={settings}
            onChange={(calendarIds) => updateRule(rule.id, { calendarIds })}
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={!!rule.blocking}
              onChange={(e) => updateRule(rule.id, { blocking: e.target.checked })}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            Matching events block time (even if marked "Free")
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            All-day matches
            <select
              value={rule.allDay ?? 'inherit'}
              onChange={(e) =>
                updateRule(rule.id, {
                  allDay: e.target.value === 'inherit' ? undefined : (e.target.value as 'block' | 'free'),
                })
              }
              className={`px-2 py-1 ${INPUT_NESTED}`}
            >
              <option value="inherit">Use global setting</option>
              <option value="block">Always block time</option>
              <option value="free">Never block time</option>
            </select>
          </label>
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
        className="w-full rounded-lg border border-dashed border-slate-400 py-2 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400"
      >
        + Add metric
      </button>
    </Section>
  )
}

/** Per-rule "scope" disclosure: which calendars the rule counts on (empty = all). */
function RuleScope({
  rule,
  calendars,
  settings,
  onChange,
}: {
  rule: MetricRule
  calendars: GCalendar[] | null
  settings: Settings
  onChange: (calendarIds: string[] | undefined) => void
}) {
  const selected = rule.calendarIds ?? []
  const all = selected.length === 0
  const summary = all
    ? 'All calendars'
    : `${selected.length} calendar${selected.length === 1 ? '' : 's'}`

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]
    onChange(next.length ? next : undefined)
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-slate-500 dark:text-slate-400">
        Scope: <span className="text-slate-700 dark:text-slate-300">{summary}</span>
      </summary>
      <div className="mt-1 space-y-1 pl-1">
        {calendars === null ? (
          <p className="text-slate-500">Loading calendars…</p>
        ) : calendars.length === 0 ? (
          <p className="text-slate-500">Check a blocking calendar on the Calendars page first.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={all}
                onChange={() => onChange(undefined)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300">All calendars</span>
            </label>
            {calendars.map((cal) => (
              <label key={cal.id} className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={selected.includes(cal.id)}
                  onChange={() => toggle(cal.id)}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cal.backgroundColor ?? getColor(settings, 'calendar.fallback') }}
                />
                <span className="text-slate-700 dark:text-slate-300">{cal.summary}</span>
              </label>
            ))}
          </>
        )}
      </div>
    </details>
  )
}
