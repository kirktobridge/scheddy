/** One top-pick day surfaced as an actionable row in the idle left rail. */
export interface PickAction {
  /** yyyy-MM-dd of the pick. */
  date: string
  /** Relative phrasing, e.g. "this Saturday". */
  label: string
  /** Free hours on the day, pre-rounded for display. */
  hours: number
}

/** The overdue-date nudge, promoted from a rail badge to an actionable row. */
export interface RitualAction {
  /** Hero phrasing, e.g. "3 days overdue for a date". */
  text: string
  /** Quiet second line, e.g. "last date 2 weeks ago". */
  detail: string
  /** Enabled only when there's a date-option day to jump to. */
  disabled?: boolean
}

interface Props {
  picks: PickAction[]
  ritual?: RitualAction
  /** Jump the canvas + day card to a pick's day. */
  onPick: (date: string) => void
  /** Act on the overdue ritual (jump to the next date-option day). */
  onRitual?: () => void
}

/**
 * The idle left rail (B-26): instead of "pick a day", the canvas offers its own
 * next moves — the soonest top picks as one-tap rows, and an overdue-date nudge
 * when relationship mode flags one. Takes the day card's place when nothing is
 * selected and no query is running. The landing surface budgets/rituals (plans
 * 7/10) extend later.
 */
export default function NextActions({ picks, ritual, onPick, onRitual }: Props) {
  if (picks.length === 0 && !ritual) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
        No free days ahead — pick any day to see its detail.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Your next moves</h2>
      {ritual && (
        <button
          type="button"
          onClick={onRitual}
          disabled={ritual.disabled}
          className="flex w-full items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-left transition hover:border-rose-300 disabled:cursor-default disabled:opacity-60 disabled:hover:border-rose-200 dark:border-rose-500/30 dark:bg-rose-500/10 dark:hover:border-rose-500/50"
        >
          <span className="text-lg leading-none">❤️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium leading-tight text-rose-700 dark:text-rose-300">{ritual.text}</span>
            <span className="block text-xs text-rose-500/80 dark:text-rose-400/70">{ritual.detail}</span>
          </span>
          {!ritual.disabled && <span className="shrink-0 text-xs font-medium text-rose-600 dark:text-rose-400">Plan →</span>}
        </button>
      )}
      {picks.length > 0 && (
        <ul className="space-y-1.5">
          {picks.map((p) => (
            <li key={p.date}>
              <button
                type="button"
                onClick={() => onPick(p.date)}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5"
              >
                <span aria-hidden className="text-sm leading-none text-amber-500 dark:text-amber-400">★</span>
                <span className="min-w-0 flex-1 text-sm font-medium capitalize text-slate-700 dark:text-slate-200">{p.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-emerald-600 dark:text-emerald-400">{p.hours}h free</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
