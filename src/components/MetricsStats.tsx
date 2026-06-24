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
  /** "★ Top picks" advanced metric: star-highlight toggle with a month pick count.
   *  When active, drills down to a "Top N this week" sub-card. */
  topPicks?: {
    count: number
    active: boolean
    color: string
    onToggle: () => void
    weekPicks?: { count: number; n: number; active: boolean; color: string; onToggle: () => void }
  }
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
  topPicks,
}: Props) {
  const cardClass = bar ? 'min-w-0 flex-1' : ''
  const rowClass = bar ? 'flex gap-2' : 'grid grid-cols-2 gap-3'
  // Grow proportionally to card count so every card across both bar groups ends
  // up the same width — keeping the whole band on one row.
  const cardCount = 2 + ruleResults.length + (topPicks ? 1 : 0)
  return (
    <section className={bar ? 'min-w-0 space-y-2' : 'space-y-2'} style={bar ? { flexBasis: 0, flexGrow: cardCount } : undefined}>
      {bar ? (
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Metrics</h2>
      ) : (
        <h2 className="text-xl font-bold">Metrics</h2>
      )}

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}
      {!loading && !error && (
        <>
          <div className={bar ? 'flex gap-2' : `grid grid-cols-2 ${dense ? 'gap-2' : 'gap-3 lg:grid-cols-4'}`}>
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
            {topPicks && (
              <StatCard
                value={topPicks.count}
                label="★ Top picks"
                active={topPicks.active}
                color={topPicks.color}
                dense={dense || bar}
                tinted={tinted}
                wrapperClass={cardClass}
                onClick={topPicks.onToggle}
              />
            )}
          </div>
          {topPicks?.active && topPicks.weekPicks && (
            <div className={`${rowClass} border-t border-slate-200 pt-2 dark:border-slate-700`}>
              <StatCard
                value={topPicks.weekPicks.count}
                label={`★ Top ${topPicks.weekPicks.n} this week`}
                active={topPicks.weekPicks.active}
                color={topPicks.weekPicks.color}
                dense={dense || bar}
                tinted={tinted}
                wrapperClass={cardClass}
                onClick={topPicks.weekPicks.onToggle}
              />
            </div>
          )}
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
