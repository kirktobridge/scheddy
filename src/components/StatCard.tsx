import type { ReactNode } from 'react'

/** A toggleable stat card: big count + label, optional color-dot picker, active ring. */
export default function StatCard({
  value,
  label,
  active,
  color,
  dense,
  wrapperClass,
  title,
  footer,
  onClick,
  onColor,
}: {
  value: number
  label: string
  active: boolean
  color: string
  dense?: boolean
  wrapperClass?: string
  /** Tooltip on the card button. */
  title?: string
  /** Small content rendered under the label (e.g. an "Overdue" badge). */
  footer?: ReactNode
  onClick: () => void
  /** When provided, a color-dot picker is shown to recolor the highlight. */
  onColor?: (color: string) => void
}) {
  return (
    <div className={`relative ${wrapperClass ?? ''}`}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        title={title}
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
        {footer && <div className="mt-1 flex justify-center">{footer}</div>}
      </button>
      {onColor && (
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
      )}
    </div>
  )
}
