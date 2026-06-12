import type { Slot, WindowKey } from '../lib/availability'
import { fmtDay, fmtTime } from '../lib/format'

const WINDOW_STYLE: Record<WindowKey, string> = {
  morning: 'bg-amber-500/20 text-amber-300',
  afternoon: 'bg-sky-500/20 text-sky-300',
  evening: 'bg-violet-500/20 text-violet-300',
}

export default function SlotList({ slots, emptyText }: { slots: Slot[]; emptyText: string }) {
  if (slots.length === 0) {
    return <p className="py-8 text-center text-slate-400">{emptyText}</p>
  }

  const byDate = new Map<string, Slot[]>()
  for (const slot of slots) {
    const list = byDate.get(slot.date) ?? []
    list.push(slot)
    byDate.set(slot.date, list)
  }

  return (
    <ul className="space-y-3">
      {[...byDate.entries()].map(([date, daySlots]) => (
        <li key={date} className="rounded-xl bg-slate-800 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-200">{fmtDay(date)}</p>
          <div className="space-y-1.5">
            {daySlots.map((slot) => (
              <div key={slot.window} className="flex items-center gap-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${WINDOW_STYLE[slot.window]}`}>
                  {slot.window}
                </span>
                <span className="text-slate-300">
                  {fmtTime(slot.freeFrom)}–{fmtTime(slot.freeTo)}
                </span>
                {!slot.fullyFree && <span className="text-xs text-slate-500">partly booked</span>}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
