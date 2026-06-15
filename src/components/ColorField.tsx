import { useEffect, useState } from 'react'

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * One configurable-color row: a swatch/native picker, a `#rrggbb` hex field that
 * reverts invalid input, and a reset button shown only when the value differs
 * from the default.
 */
export default function ColorField({
  label,
  description,
  value,
  fallback,
  onChange,
  onReset,
}: {
  label: string
  description?: string
  value: string
  /** Built-in default; reset clears the override back to this. */
  fallback: string
  onChange: (hex: string) => void
  onReset: () => void
}) {
  // Local text so users can type freely; commit only on valid hex.
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = (raw: string) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`
    if (HEX.test(v)) onChange(v.toLowerCase())
    else setText(value) // revert
  }

  return (
    <div className="flex items-center gap-3 py-1.5">
      <label
        title={label}
        className="h-6 w-6 shrink-0 cursor-pointer rounded-full border border-black/10 shadow-sm dark:border-white/20"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute h-0 w-0 opacity-0"
          aria-label={`${label} color`}
        />
      </label>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-800 dark:text-slate-200">{label}</div>
        {description && <div className="text-xs text-slate-500 dark:text-slate-400">{description}</div>}
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        spellCheck={false}
        className="w-24 px-2 py-1 text-right font-mono text-xs rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        aria-label={`${label} hex`}
      />
      {value.toLowerCase() !== fallback.toLowerCase() && (
        <button
          onClick={onReset}
          title="Reset to default"
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Reset
        </button>
      )}
    </div>
  )
}
