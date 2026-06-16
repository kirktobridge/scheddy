import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { dayTimeline, type BusyInterval, type Slot, type Windows } from '../lib/availability'
import { fmtDay, fmtTime } from '../lib/format'
import { useMediaQuery } from '../hooks/useMediaQuery'

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
  /** Currently selected day (yyyy-MM-dd); controlled by the parent. */
  selected?: string
  /** Called when a day cell is clicked. */
  onSelectDay: (date: string) => void
  /** Free slots for any day — powers the desktop hover preview. Omit to disable. */
  slotsForDate?: (date: string) => Slot[]
  /** Dates (yyyy-MM-dd) to highlight with a strong accent ring (metric overlay). */
  overlay?: Set<string> | null
  /** Highlight color for the lit overlay cells. */
  overlayColor?: string
  /**
   * Extra highlight layers drawn on top of the metric overlay, each on its own
   * visual channel so they stack without clobbering: a background `tint`, an
   * inset `ring`, or a corner `marker` glyph.
   */
  layers?: OverlayLayer[]
  /** When set, shade the mutual-free time (free of this merged busy) on the bars. */
  overlapBusy?: BusyInterval[]
  /** Color for the mutual-free overlap shading. */
  overlapShadeColor?: string
  /** Limit the overlap shading to these dates (omit = all days). */
  overlapShadeDates?: Set<string>
  /** Month whose card is selected (drives the Metrics section). */
  selectedMonth: Date
  onSelectMonth: (month: Date) => void
}

export interface OverlayLayer {
  key: string
  dates: Set<string>
  color: string
  style: 'tint' | 'ring' | 'marker'
  /** Glyph for `marker` layers (e.g. ❤️). */
  mark?: string
}

/** Vertical free/busy fill for a free day's cell: top = start of day, bottom = end. */
function DayFill({
  busy,
  windows,
  date,
  now,
  dayStart,
  overlapBusy,
  overlapShadeColor,
}: {
  busy: BusyInterval[]
  windows: Windows
  date: string
  now: Date
  dayStart: string
  overlapBusy?: BusyInterval[]
  overlapShadeColor?: string
}) {
  const { segments, nowFrac } = dayTimeline(busy, windows, date, now, dayStart)
  const overlapSegments = overlapBusy ? dayTimeline(overlapBusy, windows, date, now, dayStart).segments : []
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
      {overlapShadeColor &&
        overlapSegments
          .filter((s) => s.kind === 'free')
          .map((s, i) => (
            <div
              key={`o${i}`}
              className="absolute inset-x-0"
              style={{ top: `${s.startFrac * 100}%`, height: `${(s.endFrac - s.startFrac) * 100}%`, backgroundColor: overlapShadeColor }}
            />
          ))}
      {nowFrac > 0 && (
        <div className="absolute inset-x-0 top-0 bg-slate-100/70 dark:bg-slate-900/60" style={{ height: `${nowFrac * 100}%` }} />
      )}
    </>
  )
}

/** Lightweight free-time summary shown on cell hover (desktop). Fixed-positioned
 *  and portaled to body so the cell's overflow-hidden can't clip it. */
function HoverPreview({ date, slots, rect }: { date: string; slots: Slot[]; rect: DOMRect }) {
  const freeMs = slots.reduce((sum, s) => sum + (s.freeTo.getTime() - s.freeFrom.getTime()), 0)
  const hours = Math.round((freeMs / 3_600_000) * 10) / 10
  const ranges = slots.slice(0, 2).map((s) => `${fmtTime(s.freeFrom)}–${fmtTime(s.freeTo)}`)
  const placeAbove = rect.bottom + 140 > window.innerHeight
  const left = Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8)
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 w-max max-w-[16rem] rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-700"
      style={{
        left,
        top: placeAbove ? rect.top - 8 : rect.bottom + 8,
        transform: `translateX(-50%)${placeAbove ? ' translateY(-100%)' : ''}`,
      }}
    >
      <p className="font-semibold">{fmtDay(date)}</p>
      <p className="mt-0.5 text-emerald-300">{slots.length === 0 ? 'Fully booked' : `${hours}h free`}</p>
      {ranges.length > 0 && <p className="mt-0.5 text-slate-300">{ranges.join('  ·  ')}</p>}
    </div>,
    document.body,
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
  selected,
  onSelectDay,
  slotsForDate,
  overlay,
  overlayColor = '#fbbf24',
  layers,
  overlapBusy,
  overlapShadeColor,
  overlapShadeDates,
  selectedMonth,
  onSelectMonth,
}: Props) {
  const freeSet = useMemo(() => new Set(days.map(([d]) => d)), [days])
  // Top-pick counts per month ("yyyy-MM") for the nav badges.
  const picksByMonth = useMemo(() => {
    const m = new Map<string, number>()
    for (const [d] of days) {
      const k = d.slice(0, 7)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [days])
  const todayMs = startOfDay(now).getTime()
  const maxMs = maxDate.getTime()

  // Desktop-only hover preview: a lightweight popover anchored to the cell.
  const canHover = useMediaQuery('(min-width: 1280px) and (pointer: fine)')
  const [hover, setHover] = useState<{ date: string; rect: DOMRect } | null>(null)
  // Fixed-positioned popover goes stale on scroll — drop it.
  useEffect(() => {
    if (!hover) return
    const clear = () => setHover(null)
    window.addEventListener('scroll', clear, true)
    return () => window.removeEventListener('scroll', clear, true)
  }, [hover])

  const months = useMemo(() => {
    const first = startOfMonth(now)
    const last = startOfMonth(maxDate)
    const out: Date[] = []
    for (let m = first; m.getTime() <= last.getTime(); m = addMonths(m, 1)) out.push(m)
    return out
  }, [now, maxDate])
  // Months that have their own card — spillover days belonging to these are
  // hidden to avoid showing the same date on two cards.
  const monthKeys = useMemo(() => new Set(months.map((m) => format(m, 'yyyy-MM'))), [months])

  const nowMonth = startOfMonth(now)
  const maxMonth = startOfMonth(maxDate)
  // Single-month (xl) navigation operates on the lifted selectedMonth so the
  // viewed month also drives the Metrics section.
  const viewMonth = startOfMonth(selectedMonth)
  const prevMonth = addMonths(viewMonth, -1)
  const nextMonth = addMonths(viewMonth, 1)
  const prevDisabled = viewMonth.getTime() <= nowMonth.getTime()
  const nextDisabled = nextMonth.getTime() > maxMonth.getTime()

  /** One month's grid card. `blankSpillover` blanks adjacent-month days that have
   *  their own card (multi-month view); single view greys them instead. */
  const renderMonth = (month: Date, blankSpillover: boolean) => {
    // The rolling-window's first month starts at the current week.
    const gridStart = isSameMonth(month, now) ? startOfWeek(now) : startOfWeek(startOfMonth(month))
    const gridDays = eachDayOfInterval({ start: gridStart, end: endOfWeek(endOfMonth(month)) })
    return (
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
            {d}
          </div>
        ))}
        {gridDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, month)
          // Spillover day shown on its own month's card — blank it here.
          if (blankSpillover && !inMonth && monthKeys.has(format(day, 'yyyy-MM'))) {
            return <div key={dateStr} className="h-12" />
          }
          const active = day.getTime() >= todayMs && day.getTime() <= maxMs
          const pick = freeSet.has(dateStr)
          const today = isToday(day)
          const isSel = active && dateStr === selected
          const lit = !!overlay?.has(dateStr) && inMonth
          const cellLayers = inMonth ? (layers ?? []).filter((l) => l.dates.has(dateStr)) : []

          // Each channel stacks independently: metric overlay + tint layers wash
          // the background; ring layers nest as inset borders; markers sit in the corner.
          const tints = [
            ...(lit ? [overlayColor] : []),
            ...cellLayers.filter((l) => l.style === 'tint').map((l) => l.color),
          ]
          const rings = [
            ...(lit ? [overlayColor] : []),
            ...cellLayers.filter((l) => l.style === 'ring').map((l) => l.color),
          ]
          const markers = cellLayers.filter((l) => l.style === 'marker')
          const boxShadow = rings.map((c, i) => `inset 0 0 0 ${2 + i * 2}px ${c}`).join(', ')
          const highlighted = tints.length > 0 || rings.length > 0 || markers.length > 0

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!active || (!blankSpillover && !inMonth)}
              onClick={() => onSelectDay(dateStr)}
              onPointerEnter={
                canHover && active && slotsForDate
                  ? (e) => {
                      if (e.pointerType !== 'touch') setHover({ date: dateStr, rect: e.currentTarget.getBoundingClientRect() })
                    }
                  : undefined
              }
              onPointerLeave={canHover ? () => setHover(null) : undefined}
              onPointerDown={canHover ? () => setHover(null) : undefined}
              style={boxShadow ? { boxShadow } : undefined}
              className={`relative h-12 overflow-hidden rounded-lg text-left transition ${
                active ? 'bg-slate-200 dark:bg-slate-600' : ''
              } ${
                isSel
                  ? 'z-10 shadow-md ring-2 ring-emerald-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-800'
                  : active
                    ? 'hover:brightness-95 dark:hover:brightness-110'
                    : ''
              } ${highlighted ? 'z-20' : ''}`}
            >
              {tints.map((c, i) => (
                <div key={i} className="absolute inset-0" style={{ backgroundColor: `${c}4d` }} />
              ))}
              {active && (
                <DayFill
                  busy={busy}
                  windows={windows}
                  date={dateStr}
                  now={now}
                  dayStart={dayStart}
                  overlapBusy={overlapShadeDates && !overlapShadeDates.has(dateStr) ? undefined : overlapBusy}
                  overlapShadeColor={overlapShadeColor}
                />
              )}
              {markers.length > 0 && (
                <span className="pointer-events-none absolute right-0.5 top-0.5 z-30 text-[11px] leading-none">
                  {markers.map((l) => l.mark ?? '●').join('')}
                </span>
              )}
              {highlightPicks && pick && !isSel && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-base leading-none text-amber-500 dark:text-amber-400">
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
    )
  }

  /** "★ N" pick-count badge for a nav target month; nothing when zero. */
  const NavBadge = ({ month }: { month: Date }) => {
    const n = highlightPicks ? (picksByMonth.get(format(month, 'yyyy-MM')) ?? 0) : 0
    if (n === 0) return null
    return <span className="text-[10px] leading-none text-amber-500/80 dark:text-amber-400/80">★ {n}</span>
  }

  return (
    <div className="space-y-4">
      {/* Below xl: existing multi-month compact grid. */}
      <div className="grid gap-4 md:grid-cols-2 xl:hidden">
        {months.map((month) => {
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
              {renderMonth(month, true)}
            </div>
          )
        })}
      </div>

      {/* xl and up: one month at a time with prev/next navigation. */}
      <div className="hidden break-inside-avoid rounded-2xl bg-white p-3 shadow-sm xl:block dark:bg-slate-800 dark:shadow-none">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectMonth(prevMonth)}
            disabled={prevDisabled}
            title="Previous month"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-slate-600 transition hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-slate-600 dark:text-slate-300 dark:hover:text-emerald-400"
          >
            <span className="text-base leading-none">‹</span>
            {!prevDisabled && <NavBadge month={prevMonth} />}
          </button>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{format(viewMonth, 'MMMM yyyy')}</span>
          <button
            type="button"
            onClick={() => onSelectMonth(nextMonth)}
            disabled={nextDisabled}
            title="Next month"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-slate-600 transition hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-slate-600 dark:text-slate-300 dark:hover:text-emerald-400"
          >
            {!nextDisabled && <NavBadge month={nextMonth} />}
            <span className="text-base leading-none">›</span>
          </button>
        </div>
        {renderMonth(viewMonth, false)}
      </div>

      {hover && slotsForDate && <HoverPreview date={hover.date} slots={slotsForDate(hover.date)} rect={hover.rect} />}
    </div>
  )
}
