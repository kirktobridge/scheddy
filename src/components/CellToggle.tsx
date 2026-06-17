export default function CellToggle({
  active,
  disabled,
  onToggle,
  label,
}: {
  active: boolean
  disabled?: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold ${
        active
          ? 'border-emerald-500 bg-emerald-500 text-emerald-950'
          : 'border-slate-300 text-transparent dark:border-slate-600'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      ✓
    </button>
  )
}
