import { useEffect, useState } from 'react'
import type { TokenEntry } from '../lib/designTokens'

const HEX = /^#[0-9a-fA-F]{6}$/

const FIELD =
  'rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'

/**
 * One configurable design-token row. Shows the token's friendly label, the CSS
 * variable it drives and its current resolved value, with a control matched to
 * the token type (color swatch, length slider, or font stack). A reset button
 * appears only when the value differs from the built-in default.
 */
export default function TokenField({
  entry,
  value,
  onChange,
  onReset,
}: {
  entry: TokenEntry
  value: string
  onChange: (value: string) => void
  onReset: () => void
}) {
  const tokenName = entry.cssVars?.[0] ?? entry.key
  const isDefault = value.trim().toLowerCase() === entry.default.trim().toLowerCase()

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-800 dark:text-slate-200">{entry.label}</div>
        <div className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">{tokenName}</div>
        {entry.description && (
          <div className="text-xs text-slate-500 dark:text-slate-400">{entry.description}</div>
        )}
      </div>
      {entry.type === 'color' && <ColorControl entry={entry} value={value} onChange={onChange} />}
      {entry.type === 'length' && <LengthControl entry={entry} value={value} onChange={onChange} />}
      {entry.type === 'font' && <FontControl value={value} onChange={onChange} />}
      {!isDefault && (
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

/** Swatch + native picker + `#rrggbb` field that reverts invalid input. */
function ColorControl({
  entry,
  value,
  onChange,
}: {
  entry: TokenEntry
  value: string
  onChange: (value: string) => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = (raw: string) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`
    if (HEX.test(v)) onChange(v.toLowerCase())
    else setText(value) // revert
  }

  return (
    <>
      <label
        title={entry.label}
        className="h-6 w-6 shrink-0 cursor-pointer rounded-full border border-black/10 shadow-sm dark:border-white/20"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute h-0 w-0 opacity-0"
          aria-label={`${entry.label} color`}
        />
      </label>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        spellCheck={false}
        className={`w-24 px-2 py-1 text-right font-mono text-xs ${FIELD}`}
        aria-label={`${entry.label} value`}
      />
    </>
  )
}

/** Slider over the numeric part, with the unit reattached and shown live. */
function LengthControl({
  entry,
  value,
  onChange,
}: {
  entry: TokenEntry
  value: string
  onChange: (value: string) => void
}) {
  const unit = entry.unit ?? ''
  const num = parseFloat(value) || 0
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={entry.min}
        max={entry.max}
        step={entry.step}
        value={num}
        onChange={(e) => onChange(`${e.target.value}${unit}`)}
        className="w-28 accent-emerald-500"
        aria-label={`${entry.label} value`}
      />
      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {value}
      </span>
    </div>
  )
}

/** Free-text font stack; commits any non-empty value on blur/Enter. */
function FontControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])

  const commit = (raw: string) => {
    const v = raw.trim()
    if (v) onChange(v)
    else setText(value) // revert
  }

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
      spellCheck={false}
      style={{ fontFamily: value }}
      className={`w-44 px-2 py-1 text-right text-xs ${FIELD}`}
      aria-label="Font value"
    />
  )
}
