import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'accent' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400',
  accent: 'bg-pink-500 text-pink-950 hover:bg-pink-400',
  ghost:
    'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50',
}

/**
 * The app's standard action button: a clear, text-labelled control (no leading
 * emoji). Use `variant` for emphasis — primary (confirm), accent (date/pink),
 * ghost (secondary/cancel).
 */
export default function ActionButton({
  variant = 'ghost',
  className = '',
  ...props
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  )
}
