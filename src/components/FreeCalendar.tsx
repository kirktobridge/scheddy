import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { dayTimeline, type BusyInterval, type Slot, type WindowKey, type Windows } from '../lib/availability'
import DayTimelineCard from './DayTimelineCard'
import type { DayInfo, SlotInfo } from './SlotList'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface Props {
  /** Top free-day picks (most-free), ordered by date: [yyyy-MM-dd, that day's slots]. */
  days: [string, Slot[]][]
  windows: Windows
  /** Combined merged busy (non-work ∪ work) for the mini bars. */
  busy: BusyInterval[]
  now: Date
  /** Last day with valid availability data — days past this aren't selectable. */
  maxDate: Date
  /** Earliest clock time ("HH:mm") shown on the bars. */
  dayStart: string
  /** When true, star the top free-day picks. */
  highlightPicks: boolean
  windowOrder: WindowKey[]
  /** Free slots for any selectable day (powers the detail card). */
  slotsForDate: (date: string) => Slot[]
  dayInfo: (date: string) => DayInfo
  slotInfo: (slot: Slot) => SlotInfo
  /** Dates (yyyy-MM-dd) to highlight with a strong accent ring (metric overlay). */
  overlay?: Set<string> | null
  /** Month whose card is selected (drives the Metrics section). */
  selectedMonth: Date
  onSelectMonth: (month: Date) => void
}

/** Vertical free/busy fill for a free day's cell: top = start of day, bottom = end. */
function DayFill({
  busy,
  windows,
  date,
  now,
  dayStart,
}: {
  busy: BusyInterval[]
  windows: Windows
  date: string
  now: Date
  dayStart: string
}) {
  const { segments, nowFrac } = dayTimeline(busy, windows, date, now, dayStart)
  return (
    <>
      {segments
        .filter((s) => s.kind === 'free')
        .map((s, i) => (
          <div
            key={i}
            className="absolute inset-x-0 bg-emerald-500"
            style={{ top: `${s.startFrac * 100}%`, height: `${(s.endFrac - s.startFrac) * 100}%` }}
          />
        ))}
      {nowFrac > 0 && (
        <div className="absolute inset-x-0 top-0 bg-slate-100/70 dark:bg-slate-900/60" style={{ height: `${nowFrac * 100}%` }} />
      )}
    </>
  )
}

export default function FreeCalendar({
  days,
  windows,
  busy,
  now,
  maxDate,
  dayStart,
  highlightPicks,
  windowOrder,
  slotsForDate,
  dayInfo,
  slotInfo,
  overlay,
  selectedMonth,
  onSelectMonth,
}: Props) {
  const freeSet = useMemo(() => new Set(days.map(([d]) => d)), [days])
  const todayMs = startOfDay(now).getTime()
  const maxMs = maxDate.getTime()
  const [selected, setSelected] = useState(days[0]?.[0])
  const selectedSlots = useMemo(() => (selected ? slotsForDate(selected) : []), [selected, slotsForDate])

  const months = useMemo(() => {
    const first = startOfMonth(now)
    const last = startOfMonth(maxDate)
    const out: Date[] = []
    for (let m = first; m.getTime() <= last.getTime(); m = addMonths(m, 1)) out.push(m)
    return out
  }, [now, maxDate])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {months.map((month, mi) => {
          // First month starts at the current week — hide weeks already past.
          const gridStart = mi === 0 ? startOfWeek(now) : startOfWeek(startOfMonth(month))
          const gridDays = eachDayOfInterval({ start: gridStart, end: endOfWeek(endOfMonth(month)) })
          const monthSelected = isSameMonth(month, selectedMonth)
          return (
            <div
              key={month.toISOString()}
              className={`break-inside-avoid rounded-2xl bg-white p-3 shadow-sm transition dark:bg-slate-800 dark:shadow-none ${
                monthSelected ? 'ring-2 ring-emerald-500' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectMonth(month)}
                title="Show this month's metrics"
                className={`mb-2 w-full rounded-md px-1 py-0.5 text-left text-sm font-semibold transition ${
                  monthSelected
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-800 hover:text-emerald-600 dark:text-slate-100 dark:hover:text-emerald-400'
                }`}
              >
                {format(month, 'MMMM yyyy')}
                {monthSelected && <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">metrics</span>}
              </button>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="pb-1 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {d}
                  </div>
                ))}
                {gridDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const active = day.getTime() >= todayMs && day.getTime() <= maxMs
                  const pick = freeSet.has(dateStr)
                  const inMonth = isSameMonth(day, month)
                  const today = isToday(day)
                  const isSel = active && dateStr === selected
                  const lit = !!overlay?.has(dateStr) && inMonth

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={!active}
                      onClick={() => setSelected(dateStr)}
                      className={`relative h-12 overflow-hidden rounded-lg text-left transition ${
                        active ? 'bg-slate-200 dark:bg-slate-600' : ''
                      } ${isSel ? 'z-10 shadow-md' : active ? 'hover:brightness-95 dark:hover:brightness-110' : ''} ${
                        lit ? 'z-20 ring-2 ring-inset ring-amber-400 ring-offset-1 ring-offset-amber-400/40' : ''
                      }`}
                    >
                      {lit && <div className="absolute inset-0 bg-amber-400/30" />}
                      {active && <DayFill busy={busy} windows={windows} date={dateStr} now={now} dayStart={dayStart} />}
                      {highlightPicks && pick && !isSel && (
                        <span className="absolute right-0.5 top-0.5 text-[10px] leading-none text-emerald-600 dark:text-emerald-400">
                          ★
                        </span>
                      )}
                      <span
                        className={`absolute left-1 top-0.5 rounded px-0.5 text-[10px] leading-tight ${
                          isSel
                            ? 'bg-emerald-600 font-semibold text-white'
                            : today
                              ? 'font-bold text-emerald-700 dark:text-emerald-300'
                              : !inMonth
                                ? 'text-slate-300 dark:text-slate-600'
                                : active
                                  ? 'bg-white/75 font-medium text-slate-700 dark:bg-slate-900/60 dark:text-slate-100'
                                  : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <DayTimelineCard
          date={selected}
          slots={selectedSlots}
          windows={windows}
          busy={busy}
          now={now}
          dayStart={dayStart}
          windowOrder={windowOrder}
          dayInfo={dayInfo}
          slotInfo={slotInfo}
        />
      )}
    </div>
  )
}
