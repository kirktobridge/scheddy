import { dayTimeline, daySpan, freeGaps, mergeIntervals, type BusyInterval, type Slot, type WindowKey, type Windows } from '../lib/availability'
import { summarizeDay } from '../lib/annotate'
import { fmtDay, fmtTime } from '../lib/format'
import type { DayInfo, SlotInfo } from './SlotList'

interface Props {
  date: string
  /** That day's free slots (already capped/adjusted by the page). */
  slots: Slot[]
  windows: Windows
  /** Combined merged busy (non-work ∪ work) for the bar. */
  busy: BusyInterval[]
  now: Date
  /** Earliest clock time ("HH:mm") shown on the bar. */
  dayStart: string
  /** Full ordered set of window names — for the "free all day" check. */
  windowOrder: WindowKey[]
  dayInfo: (date: string) => DayInfo
  slotInfo: (slot: Slot) => SlotInfo
  /** When set, shade the mutual-free time (free of this merged busy) on the bar. */
  overlapBusy?: BusyInterval[]
  /** Color for the mutual-free overlap shading + relationship accents. */
  overlapShadeColor?: string
  /** Partner's merged busy — renders a second "who's free" lane (relationship mode). */
  partnerBusy?: BusyInterval[]
  /** Partner's display name for the lane label. */
  partnerName?: string
  /** Reason chips when this day is a date candidate. */
  reasons?: string[]
}

const HALF_HOUR = 30 * 60 * 1000

export default function DayTimelineCard({ date, slots, windows, busy, now, dayStart, windowOrder, dayInfo, slotInfo, overlapBusy, overlapShadeColor, partnerBusy, partnerName, reasons }: Props) {
  const info = dayInfo(date)
  const { segments, nowFrac, ticks } = dayTimeline(busy, windows, date, now, dayStart)
  const overlapSegments = overlapBusy ? dayTimeline(overlapBusy, windows, date, now, dayStart).segments : []

  const summary = summarizeDay(slots, windowOrder)
  const allDay = summary === 'free all day'
  const ranges = slots.map((s) => `${fmtTime(s.freeFrom)}–${fmtTime(s.freeTo)}`)
  const afterWork = slots.some((s) => s.freeAfterWork)
  const warning = slots.map((s) => slotInfo(s).warning).find(Boolean)

  // Relationship insight: partner lane + the times you're both free.
  const accent = overlapShadeColor ?? '#ec4899'
  const partnerSegments = partnerBusy ? dayTimeline(partnerBusy, windows, date, now, dayStart).segments : []
  const span = partnerBusy ? daySpan(windows, date, dayStart) : null
  const mutualGaps = span
    ? freeGaps(mergeIntervals([...busy, ...partnerBusy!]), span.start, span.end).filter(
        (g) => g.end.getTime() - g.start.getTime() >= HALF_HOUR,
      )
    : []
  const fmtDur = (ms: number) => `${Math.round((ms / 3_600_000) * 10) / 10}h`

  return (
    <div className="break-inside-avoid rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800 dark:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{fmtDay(date)}</p>
          {info.label && <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{info.label}</p>}
        </div>
        {info.note && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            🎉 {info.note}
          </span>
        )}
      </div>

      {reasons && reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {reasons.map((r, i) => (
            <span
              key={i}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              ❤️ {r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        {partnerBusy && (
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">You</p>
        )}
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          {segments
            .filter((s) => s.kind === 'free')
            .map((s, i) => (
              <div
                key={i}
                className="absolute inset-y-0 bg-emerald-500"
                style={{ left: `${s.startFrac * 100}%`, width: `${(s.endFrac - s.startFrac) * 100}%` }}
              />
            ))}
          {overlapShadeColor &&
            overlapSegments
              .filter((s) => s.kind === 'free')
              .map((s, i) => (
                <div
                  key={`o${i}`}
                  className="absolute inset-y-0"
                  style={{ left: `${s.startFrac * 100}%`, width: `${(s.endFrac - s.startFrac) * 100}%`, backgroundColor: overlapShadeColor }}
                />
              ))}
          {ticks.slice(1, -1).map((t, i) => (
            <div
              key={i}
              className="absolute inset-y-0 w-px bg-white/70 dark:bg-slate-900/60"
              style={{ left: `${t.frac * 100}%` }}
            />
          ))}
          {nowFrac > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-slate-100/70 dark:bg-slate-900/60"
              style={{ width: `${nowFrac * 100}%` }}
            />
          )}
        </div>
        {partnerBusy && (
          <div className="mt-2">
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {partnerName || 'Partner'}
            </p>
            <div className="relative h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              {partnerSegments
                .filter((s) => s.kind === 'free')
                .map((s, i) => (
                  <div
                    key={i}
                    className="absolute inset-y-0 bg-indigo-400"
                    style={{ left: `${s.startFrac * 100}%`, width: `${(s.endFrac - s.startFrac) * 100}%` }}
                  />
                ))}
              {nowFrac > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-slate-100/70 dark:bg-slate-900/60"
                  style={{ width: `${nowFrac * 100}%` }}
                />
              )}
            </div>
          </div>
        )}
        <div className="relative mt-1 h-3">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-slate-400 dark:text-slate-500"
              style={{
                left: `${t.frac * 100}%`,
                transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
        {slots.length === 0 ? 'Fully booked' : allDay ? 'Free all day' : ranges.join('  ·  ')}
        {afterWork && <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">free after work</span>}
      </p>
      {partnerBusy && (
        <p className="mt-1 text-xs font-medium" style={{ color: accent }}>
          {mutualGaps.length > 0
            ? `Both free ${mutualGaps.map((g) => `${fmtTime(g.start)}–${fmtTime(g.end)} (${fmtDur(g.end.getTime() - g.start.getTime())})`).join('  ·  ')}`
            : 'No shared free time'}
        </p>
      )}
      {warning && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">⚠ {warning}</p>}
    </div>
  )
}
