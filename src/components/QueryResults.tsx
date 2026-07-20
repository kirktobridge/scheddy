import { format } from 'date-fns'
import type { Slot, WindowKey } from '../lib/availability'
import SlotList, { type DayInfo, type SlotInfo } from './SlotList'

interface Props {
  range: [Date, Date]
  slots: Slot[]
  /** One-line range busyness summary, e.g. "3 of 6 days already booked." */
  summary: string
  windowOrder: WindowKey[]
  /** True when the query is scoped to mutual (both-of-us) free time. */
  bothOfUs: boolean
  dayInfo?: (date: string) => DayInfo
  slotInfo?: (slot: Slot) => SlotInfo
  onClear: () => void
}

/**
 * Left-rail view for an active canvas query (B-24) — takes the place of the day
 * card while a query is running. Lists the matching free slots with a one-line
 * range summary; clearing (or Escape) returns the rail to the day card / idle.
 */
export default function QueryResults({
  range,
  slots,
  summary,
  windowOrder,
  bothOfUs,
  dayInfo,
  slotInfo,
  onClear,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {bothOfUs ? 'When are we both free?' : 'When are we free?'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {format(range[0], 'EEE, MMM d')} – {format(range[1], 'EEE, MMM d')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          title="Clear query (Esc)"
          aria-label="Clear query"
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          ✕
        </button>
      </div>
      {summary && <p className="text-xs text-slate-500 dark:text-slate-400">{summary}</p>}
      <SlotList
        slots={slots}
        emptyText="No free slots in this range."
        windowOrder={windowOrder}
        dayInfo={dayInfo}
        slotInfo={slotInfo}
      />
    </div>
  )
}
