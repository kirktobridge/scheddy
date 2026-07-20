import type { ReactNode } from 'react'

/** A contextual verb attached to a defense row (Show/Hide a layer, Plan a date, …). */
export interface DefenseAction {
  label: string
  onClick: () => void
  /** Pressed state for toggle-style verbs (Show/Hide). */
  active?: boolean
  disabled?: boolean
}

/** One defensive status line: a sentence about your free time, plus an optional action. */
export interface DefenseRow {
  key: string
  /** Leading glyph (e.g. ❤️); optional. */
  icon?: string
  /** The status sentence, phrased defensively ("3 free weekend days left in July"). */
  text: ReactNode
  /** A quieter second line (e.g. the date rhythm cadence). */
  detail?: ReactNode
  action?: DefenseAction
}

function ActionButton({ action }: { action: DefenseAction }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      aria-pressed={action.active}
      className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${
        action.active
          ? 'bg-emerald-500 text-emerald-950'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      {action.label}
    </button>
  )
}

/**
 * The right-rail "defense column": status rows in words, each with an optional
 * contextual verb. Replaces the scoreboard stat cards — counts read defensively
 * and the date cadence is a first-class rhythm line, not a tooltip. This is the
 * row pattern the vision plans (budgets, rituals, countdowns) build on.
 */
export default function DefenseRail({ rows }: { rows: DefenseRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-1">
      <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Defense</h2>
      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">
                {row.icon && <span className="mr-1">{row.icon}</span>}
                {row.text}
              </p>
              {row.detail && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{row.detail}</p>}
            </div>
            {row.action && <ActionButton action={row.action} />}
          </div>
        ))}
      </div>
    </section>
  )
}
