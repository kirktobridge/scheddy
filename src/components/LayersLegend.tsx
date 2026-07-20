/** A single toggleable overlay layer in the legend. */
export interface LegendItem {
  key: string
  label: string
  count: number
  /** Swatch color; omit for glyph-led rows (e.g. ★ Top picks) that carry no tint. */
  color?: string
  active: boolean
  onToggle: () => void
  /** Sub-layers revealed while this item is active (e.g. the overlap subsets). */
  children?: LegendItem[]
}

function Row({ item, indent }: { item: LegendItem; indent?: boolean }) {
  return (
    <button
      type="button"
      onClick={item.onToggle}
      aria-pressed={item.active}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition ${
        indent ? 'pl-6' : ''
      } ${
        item.active
          ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'
      }`}
    >
      <span
        aria-hidden
        className={`h-3 w-3 shrink-0 rounded-full border ${
          item.active ? 'border-transparent' : 'border-slate-300 dark:border-slate-600'
        }`}
        style={item.color ? { backgroundColor: item.active ? item.color : 'transparent', borderColor: item.color } : undefined}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <span className="shrink-0 tabular-nums text-xs text-slate-400 dark:text-slate-500">{item.count}</span>
    </button>
  )
}

/**
 * The canvas "Layers" legend: a compact list of overlay toggles that used to live
 * on the stat cards. It *configures the view* (which highlights the map carries) —
 * status and actions live in the DefenseRail below it.
 */
export default function LayersLegend({ items }: { items: LegendItem[] }) {
  return (
    <section className="space-y-1">
      <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Layers</h2>
      <div className="space-y-0.5">
        {items.map((item) => (
          <div key={item.key} className="space-y-0.5">
            <Row item={item} />
            {item.active &&
              item.children?.map((child) => <Row key={child.key} item={child} indent />)}
          </div>
        ))}
      </div>
    </section>
  )
}
