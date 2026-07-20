import { useEffect, useRef } from 'react'
import type { Metrics } from '../hooks/useMetrics'
import { ErrorBanner, Spinner } from './Banner'
import StatCard from './StatCard'

interface Props extends Metrics {
  /** Highlight color for a metric key (with default fallback). */
  colorFor: (key: string) => string
  /** Compact card sizing (smaller padding/numbers). */
  dense?: boolean
  /** Full-width single-row layout (the desktop selector bar) instead of a grid. */
  bar?: boolean
  /** Compact 2-column side-panel column (the desktop left rail). */
  panel?: boolean
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
  loading,
  error,
  eveningDates,
  weekendDates,
  ruleResults,
  activeKeys,
  toggle,
  colorFor,
  dense,
  bar,
  panel,
  tinted,
  topPicks,
}: Props) {
  // Once metrics have loaded once, keep the (stale) cards visible during
  // month-change reloads instead of flashing back to a spinner each page.
  const hasLoaded = useRef(false)
  useEffect(() => {
    if (!loading) hasLoaded.current = true
  }, [loading])
  const showSpinner = loading && !hasLoaded.current

  const cardClass = bar ? 'min-w-0 flex-1' : ''
  const compact = dense || bar || panel
  const square = !!panel
  const rowClass = bar ? 'flex gap-2' : 'grid grid-cols-2 gap-2'
  // Grow proportionally to card count so every card across both bar groups ends
  // up the same width — keeping the whole band on one row.
  const cardCount = 2 + ruleResults.length + (topPicks ? 1 : 0)
  return (
    <section className={bar ? 'min-w-0 space-y-2' : 'space-y-2'} style={bar ? { flexBasis: 0, flexGrow: cardCount } : undefined}>
      {panel ? (
        <h2 className="text-center text-base font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Metrics</h2>
      ) : bar ? (
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Metrics</h2>
      ) : (
        <h2 className="text-xl font-bold">Metrics</h2>
      )}

      {error && <ErrorBanner message={error} />}
      {showSpinner && <Spinner />}
      {!showSpinner && !error && (
        <>
          <div className={bar ? 'flex gap-2' : `grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3 lg:grid-cols-4'}`}>
            <StatCard
              value={eveningDates.length}
              label="unbooked evenings"
              active={activeKeys.has('evenings')}
              color={colorFor('evenings')}
              dense={compact}
              square={square}
              tinted={tinted}
              wrapperClass={cardClass}
              onClick={() => toggle('evenings')}
            />
            <StatCard
              value={weekendDates.length}
              label="free weekend days"
              active={activeKeys.has('weekend')}
              color={colorFor('weekend')}
              dense={compact}
              square={square}
              tinted={tinted}
              wrapperClass={cardClass}
              onClick={() => toggle('weekend')}
            />
            {ruleResults.map(({ rule, matched }) => (
              <StatCard
                key={rule.id}
                value={matched.length}
                label={`${rule.icon} ${rule.name}`}
                active={activeKeys.has(`rule:${rule.id}`)}
                color={colorFor(`rule:${rule.id}`)}
                dense={compact}
                square={square}
                tinted={tinted}
                wrapperClass={cardClass}
                onClick={() => toggle(`rule:${rule.id}`)}
              />
            ))}
            {/* In the rail, the expandable "★ Top picks" parent drops below the
                grid as a full-width bar (see after this div). */}
            {topPicks && !panel && (
              <StatCard
                value={topPicks.count}
                label="★ Top picks"
                active={topPicks.active}
                color={topPicks.color}
                dense={compact}
                square={square}
                tinted={tinted}
                wrapperClass={cardClass}
                onClick={topPicks.onToggle}
              />
            )}
          </div>
          {topPicks && panel && (
            <StatCard
              value={topPicks.count}
              label="★ Top picks"
              active={topPicks.active}
              color={topPicks.color}
              dense={compact}
              wide
              tinted={tinted}
              onClick={topPicks.onToggle}
            />
          )}
          {topPicks?.active && topPicks.weekPicks && (
            <div className={`${panel ? 'grid grid-cols-1 gap-2' : rowClass} border-t border-slate-200 pt-2 dark:border-slate-700`}>
              <StatCard
                value={topPicks.weekPicks.count}
                label={`★ Top ${topPicks.weekPicks.n} this week`}
                active={topPicks.weekPicks.active}
                color={topPicks.weekPicks.color}
                dense={compact}
                square={panel ? false : square}
                tinted={tinted}
                wrapperClass={cardClass}
                onClick={topPicks.weekPicks.onToggle}
              />
            </div>
          )}
          {!bar && !panel && (
            <p className="text-xs text-slate-500">
              Tap a metric to highlight the days it counts on the calendar; set highlight colors in Settings → Appearance.
              Keyword metrics match events on your selected calendars by title; edit rules in Settings.
            </p>
          )}
        </>
      )}
    </section>
  )
}
