export default function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-300">
      {label && (
        <div className="flex items-center justify-between">
          <span>{label}</span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">{format(value)}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-1 w-full accent-emerald-500"
        />
        {!label && (
          <span className="mt-1 w-20 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">
            {format(value)}
          </span>
        )}
      </div>
    </div>
  )
}
