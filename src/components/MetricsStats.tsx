import type { Metrics } from '../hooks/useMetrics'
import { ErrorBanner, Spinner } from './Banner'

interface Props extends Metrics {
  /** Highlight color for a metric key (with default fallback). */
  colorFor: (key: string) => string
  /** Persist a new highlight color for a metric key. */
  onColor: (key: string, color: string) => void
  /** Compact card sizing (smaller padding/numbers). */
  dense?: boolean
  /** Full-width single-row layout (the desktop selector bar) instead of a grid. */
  bar?: boolean
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
}: Props) {
  const cardClass = bar ? 'w-40' : ''
  return (
    <section className="space-y-2">
      {!bar && <h2 className="text-xl font-bold">Metrics</h2>}

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

function StatCard({
  value,
  label,
  active,
  color,
  dense,
  wrapperClass,
  onClick,
  onColor,
}: {
  value: number
  label: string
  active: boolean
  color: string
  dense?: boolean
  wrapperClass?: string
  onClick: () => void
  onColor: (color: string) => void
}) {
  return (
    <div className={`relative ${wrapperClass ?? ''}`}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        style={active ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
        className={`w-full rounded-xl text-center shadow-sm transition dark:shadow-none ${dense ? 'p-3' : 'p-4'} ${
          active ? 'bg-white dark:bg-slate-800' : 'bg-white hover:brightness-95 dark:bg-slate-800 dark:hover:brightness-110'
        }`}
      >
        <p
          className={`font-bold ${dense ? 'text-2xl' : 'text-3xl'} ${active ? '' : 'text-emerald-600 dark:text-emerald-400'}`}
          style={active ? { color } : undefined}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </button>
      <label
        title="Set highlight color"
        className="absolute right-1.5 top-1.5 h-4 w-4 cursor-pointer rounded-full border border-black/10 shadow-sm dark:border-white/20"
        style={{ backgroundColor: color }}
      >
        <input
          type="color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`Highlight color for ${label}`}
        />
      </label>
    </div>
  )
}
