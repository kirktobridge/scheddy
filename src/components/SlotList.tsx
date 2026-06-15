import type { Slot, WindowKey } from '../lib/availability'
import { summarizeDay } from '../lib/annotate'
import { fmtDay, fmtTime } from '../lib/format'

const BADGE_STYLES = [
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
]
// Keep the three defaults on their original colors; custom windows get a
// stable color hashed from their name.
const KNOWN: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 }
function windowStyle(name: WindowKey): string {
  let idx = KNOWN[name]
  if (idx === undefined) {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    idx = h % BADGE_STYLES.length
  }
  return BADGE_STYLES[idx]
}

export interface DayInfo {
  /** e.g. "tomorrow", "next Thursday" */
  label?: string
  /** e.g. "2 days before Memorial Day" */
  note?: string
}

export interface SlotInfo {
  /** Intruding events for partly booked slots. */
  bookings?: string[]
  /** e.g. "early start next day: Dentist at 9am" */
  warning?: string
}

interface Props {
  slots: Slot[]
  emptyText: string
  /** Full ordered set of window names — used by the per-day summary. */
  windowOrder?: WindowKey[]
  dayInfo?: (date: string) => DayInfo
  slotInfo?: (slot: Slot) => SlotInfo
}

export default function SlotList({ slots, emptyText, windowOrder = [], dayInfo, slotInfo }: Props) {
  if (slots.length === 0) {
    return <p className="py-8 text-center text-slate-500 dark:text-slate-400">{emptyText}</p>
  }

  const byDate = new Map<string, Slot[]>()
  for (const slot of slots) {
    const list = byDate.get(slot.date) ?? []
    list.push(slot)
    byDate.set(slot.date, list)
  }

  return (
    <ul className="space-y-3">
      {[...byDate.entries()].map(([date, daySlots]) => {
        const info = dayInfo?.(date) ?? {}
        return (
          <li key={date} className="break-inside-avoid rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800 dark:shadow-none">
            <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {fmtDay(date)}
              {info.label && <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">· {info.label}</span>}
              {dayInfo && (
                <span className="ml-2 font-normal text-emerald-600 capitalize dark:text-emerald-400">
                  · {summarizeDay(daySlots, windowOrder)}
                </span>
              )}
            </p>
            {info.note && <p className="-mt-1 mb-2 text-xs text-emerald-600 dark:text-emerald-400">🎉 {info.note}</p>}
            <div className="space-y-1.5">
              {daySlots.map((slot) => {
                const extra = slotInfo?.(slot) ?? {}
                return (
                  <div key={slot.window} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${windowStyle(slot.window)}`}
                      >
                        {slot.window}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {fmtTime(slot.freeFrom)}–{fmtTime(slot.freeTo)}
                      </span>
                      {slot.freeAfterWork ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">free after work</span>
                      ) : (
                        !slot.fullyFree && <span className="text-xs text-slate-500">partly booked</span>
                      )}
                    </div>
                    {extra.bookings && extra.bookings.length > 0 && (
                      <p className="mt-0.5 ml-1 text-xs text-slate-500 dark:text-slate-400">
                        around: {extra.bookings.join(', ')}
                      </p>
                    )}
                    {extra.warning && (
                      <p className="mt-0.5 ml-1 text-xs text-amber-600 dark:text-amber-400">⚠️ {extra.warning}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
