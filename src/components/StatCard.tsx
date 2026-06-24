import type { ReactNode } from 'react'
import { readableTextColor } from '../lib/colorMix'

/** A toggleable stat card: big count + label, optional color-dot picker, active ring. */
export default function StatCard({
  value,
  label,
  active,
  color,
  dense,
  tinted,
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
  /** Slate background so the card stands out inside a white container. */
  tinted?: boolean
  wrapperClass?: string
  /** Tooltip on the card button. */
  title?: string
  /** Small content rendered under the label (e.g. an "Overdue" badge). */
  footer?: ReactNode
  onClick: () => void
  /** When provided, a color-dot picker is shown to recolor the highlight. */
  onColor?: (color: string) => void
}) {
  // Inactive cards keep the neutral white/slate surface; active cards fill with
  // the picked color (text auto-contrasted below).
  const bg = active
    ? ''
    : tinted
      ? 'bg-slate-100 hover:brightness-95 dark:bg-slate-700/60 dark:hover:brightness-110'
      : 'bg-white hover:brightness-95 dark:bg-slate-800 dark:hover:brightness-110'
  const text = active ? readableTextColor(color) : undefined
  return (
    <div className={`relative ${wrapperClass ?? ''}`}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        title={title}
        style={active ? { backgroundColor: color } : undefined}
        className={`w-full rounded-xl text-center shadow-sm transition dark:shadow-none ${dense ? 'p-3' : 'p-4'} ${bg}`}
      >
        <p
          className={`font-bold ${dense ? 'text-2xl' : 'text-3xl'} ${active ? '' : 'text-emerald-600 dark:text-emerald-400'}`}
          style={active ? { color: text } : undefined}
        >
          {value}
        </p>
        <p
          className={`mt-1 text-xs ${active ? '' : 'text-slate-500 dark:text-slate-400'}`}
          style={active ? { color: text, opacity: 0.7 } : undefined}
        >
          {label}
        </p>
        {footer && <div className="mt-1 flex justify-center">{footer}</div>}
      </button>
      {onColor && (
        <label
          title="Set highlight color"
          className="absolute right-1.5 top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center text-xs leading-none"
        >
          <span aria-hidden>🎨</span>
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
