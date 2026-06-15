import type { Metrics } from '../hooks/useMetrics'
import { ErrorBanner, Spinner } from './Banner'

/** "Metrics" header + the toggleable stat cards (free-time + keyword rules). Top of the Free page. */
export default function MetricsStats({
  isCurrent,
  loading,
  error,
  eveningDates,
  weekendDates,
  ruleResults,
  activeKey,
  toggle,
}: Metrics) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">Metrics</h2>

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              value={eveningDates.length}
              label={isCurrent ? 'unbooked evenings left' : 'unbooked evenings'}
              active={activeKey === 'evenings'}
              onClick={() => toggle('evenings')}
            />
            <StatCard
              value={weekendDates.length}
              label={isCurrent ? 'free weekend days left' : 'free weekend days'}
              active={activeKey === 'weekend'}
              onClick={() => toggle('weekend')}
            />
            {ruleResults.map(({ rule, matched }) => (
              <StatCard
                key={rule.id}
                value={matched.length}
                label={`${rule.icon} ${rule.name}`}
                active={activeKey === `rule:${rule.id}`}
                onClick={() => toggle(`rule:${rule.id}`)}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Tap a metric to highlight the days it counts on the calendar. Keyword metrics match events on your selected
            calendars by title; edit rules in Settings.
          </p>
        </>
      )}
    </section>
  )
}

function StatCard({
  value,
  label,
  active,
  onClick,
}: {
  value: number
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl p-4 text-center shadow-sm transition dark:shadow-none ${
        active
          ? 'bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-400/10'
          : 'bg-white hover:brightness-95 dark:bg-slate-800 dark:hover:brightness-110'
      }`}
    >
      <p className={`text-3xl font-bold ${active ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </button>
  )
}
