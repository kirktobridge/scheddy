import type { Metrics } from '../hooks/useMetrics'
import { ErrorBanner, Spinner } from './Banner'
import StatCard from './StatCard'

interface Props extends Metrics {
  /** Highlight color for a metric key (with default fallback). */
  colorFor: (key: string) => string
  /** Persist a new highlight color for a metric key. */
  onColor: (key: string, color: string) => void
  /** Compact card sizing (smaller padding/numbers). */
  dense?: boolean
  /** Full-width single-row layout (the desktop selector bar) instead of a grid. */
  bar?: boolean
  /** Slate card backgrounds, for sitting inside the white calendar card. */
  tinted?: boolean
}

/** "Metrics" header + the toggleable stat cards (free-time + keyword rules). Top of the Free page. */
export default function MetricsStats({
  isCurrent,
  loading,
  error,
  eveningDates,
  weekendDates,
  ruleResults,
  activeKeys,
  toggle,
  colorFor,
  onColor,
  dense,
  bar,
  tinted,
}: Props) {
  const cardClass = bar ? 'w-40' : ''
  return (
    <section className="space-y-2">
      {bar ? (
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Metrics</h2>
      ) : (
        <h2 className="text-xl font-bold">Metrics</h2>
      )}

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}
      {!loading && !error && (
        <>
          <div className={bar ? 'flex flex-wrap gap-2' : `grid grid-cols-2 ${dense ? 'gap-2' : 'gap-3 lg:grid-cols-4'}`}>
            <StatCard
              value={eveningDates.length}
              label={isCurrent ? 'unbooked evenings left' : 'unbooked evenings'}
              active={activeKeys.has('evenings')}
              color={colorFor('evenings')}
              dense={dense || bar}
              tinted={tinted}
              wrapperClass={cardClass}
              onClick={() => toggle('evenings')}
              onColor={(c) => onColor('evenings', c)}
            />
            <StatCard
              value={weekendDates.length}
              label={isCurrent ? 'free weekend days left' : 'free weekend days'}
              active={activeKeys.has('weekend')}
              color={colorFor('weekend')}
              dense={dense || bar}
              tinted={tinted}
              wrapperClass={cardClass}
              onClick={() => toggle('weekend')}
              onColor={(c) => onColor('weekend', c)}
            />
            {ruleResults.map(({ rule, matched }) => (
              <StatCard
                key={rule.id}
                value={matched.length}
                label={`${rule.icon} ${rule.name}`}
                active={activeKeys.has(`rule:${rule.id}`)}
                color={colorFor(`rule:${rule.id}`)}
                dense={dense || bar}
                tinted={tinted}
                wrapperClass={cardClass}
                onClick={() => toggle(`rule:${rule.id}`)}
                onColor={(c) => onColor(`rule:${rule.id}`, c)}
              />
            ))}
          </div>
          {!bar && (
            <p className="text-xs text-slate-500">
              Tap a metric to highlight the days it counts on the calendar; use the color dot to set its highlight color.
              Keyword metrics match events on your selected calendars by title; edit rules in Settings.
            </p>
          )}
        </>
      )}
    </section>
  )
}
