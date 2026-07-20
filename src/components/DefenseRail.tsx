/** A contextual verb attached to a defense row (Show/Hide a layer, Plan a date, …). */
export interface DefenseAction {
  label: string
  onClick: () => void
  /** Pressed state for toggle-style verbs (Show/Hide). */
  active?: boolean
  disabled?: boolean
}

/** An ambient scarcity/cadence bar: how much free time remains, or progress to due. */
export interface DefenseMeter {
  value: number
  max: number
  /** Warm tone for an overdue / depleted state. */
  warn?: boolean
}

/** One defensive status line: a hero number, a defensive label, an optional meter + verb. */
export interface DefenseRow {
  key: string
  /** The glanceable hero magnitude. */
  value: number | string
  /** What the number counts, phrased defensively ("free weekend days"). */
  label: string
  /** A quieter second line (scope or cadence context, e.g. "left in July"). */
  detail?: string
  /** Layer color echoed as a left accent bar, tying the row to its map overlay. */
  accent?: string
  meter?: DefenseMeter
  action?: DefenseAction
}

function ActionButton({ action }: { action: DefenseAction }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      aria-pressed={action.active}
      className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
        action.active
          ? 'bg-emerald-500 text-emerald-950'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      {action.label}
    </button>
  )
}

function Meter({ meter, accent }: { meter: DefenseMeter; accent?: string }) {
  const frac = meter.max > 0 ? Math.min(1, Math.max(0, meter.value / meter.max)) : 0
  const fill = meter.warn ? '#f43f5e' : accent ?? '#10b981'
  return (
    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700">
      <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, backgroundColor: fill }} />
    </div>
  )
}

/**
 * The right-rail "defense column": number-led status rows, phrased defensively,
 * each with an optional ambient meter and a contextual verb. The number leads so
 * magnitudes stay glanceable; the framing ("left in July", overdue) keeps it a
 * calm advisor, not a scoreboard. This is the row pattern the vision plans
 * (budgets, rituals, countdowns) build on.
 */
export default function DefenseRail({ rows }: { rows: DefenseRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-1">
      <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Defense</h2>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-none"
          >
            {row.accent && (
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: row.accent }} />
            )}
            <div className="flex items-center gap-3 pl-1.5">
              <span className="min-w-[1.75rem] text-center text-3xl font-bold leading-none tabular-nums text-slate-800 dark:text-white">
                {row.value}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight text-slate-700 dark:text-slate-200">{row.label}</p>
                {row.detail && <p className="text-xs text-slate-400 dark:text-slate-500">{row.detail}</p>}
              </div>
              {row.action && <ActionButton action={row.action} />}
            </div>
            {row.meter && <Meter meter={row.meter} accent={row.accent} />}
          </div>
        ))}
      </div>
    </section>
  )
}
