import { useState, type ReactNode } from 'react'
import { dayTimeline, daySpan, freeGaps, mergeIntervals, type BusyInterval, type Slot, type WindowKey, type Windows } from '../lib/availability'
import { summarizeDay } from '../lib/annotate'
import { eventStart, fmtDay, fmtTime } from '../lib/format'
import type { GEvent } from '../api/calendar'
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
  /** That day's events for the schedule list; undefined hides the schedule entirely. */
  events?: GEvent[]
  /** calendarId → color for the schedule row dots. */
  calendarColors?: Map<string, string | undefined>
  /** Book a date in this day's longest mutual-free window (relationship mode). */
  onPlanDate?: (start: Date, end: Date) => Promise<void> | void
  /** Minimum date length (hours) used to size the proposed booking. */
  dateMinHours?: number
}

const HALF_HOUR = 30 * 60 * 1000

function Chip({
  icon,
  tone = 'default',
  title,
  children,
}: {
  icon: string
  tone?: 'default' | 'warn'
  title?: string
  children: ReactNode
}) {
  const tones = {
    default: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
    warn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  )
}

export default function DayTimelineCard({ date, slots, windows, busy, now, dayStart, windowOrder, dayInfo, slotInfo, overlapBusy, overlapShadeColor, partnerBusy, partnerName, reasons, events, calendarColors, onPlanDate, dateMinHours }: Props) {
  const info = dayInfo(date)
  const { segments, nowFrac, ticks } = dayTimeline(busy, windows, date, now, dayStart)
  const overlapSegments = overlapBusy ? dayTimeline(overlapBusy, windows, date, now, dayStart).segments : []

  const summary = summarizeDay(slots, windowOrder)
  const allDay = summary === 'free all day'
  const ranges = slots.map((s) => `${fmtTime(s.freeFrom)}–${fmtTime(s.freeTo)}`)
  const afterWork = slots.some((s) => s.freeAfterWork)
  const warning = slots.map((s) => slotInfo(s).warning).find(Boolean)

  // Relationship insight: partner lane + the times you're both free.
  const partnerSegments = partnerBusy ? dayTimeline(partnerBusy, windows, date, now, dayStart).segments : []
  const span = partnerBusy ? daySpan(windows, date, dayStart) : null
  const mutualGaps = span
    ? freeGaps(mergeIntervals([...busy, ...partnerBusy!]), span.start, span.end).filter(
        (g) => g.end.getTime() - g.start.getTime() >= HALF_HOUR,
      )
    : []
  const fmtDur = (ms: number) => `${Math.round((ms / 3_600_000) * 10) / 10}h`

  const freeTotal = slots.reduce((ms, s) => ms + (s.freeTo.getTime() - s.freeFrom.getTime()), 0)
  const mutualTotal = mutualGaps.reduce((ms, g) => ms + (g.end.getTime() - g.start.getTime()), 0)
  const mutualRanges = mutualGaps.map((g) => `${fmtTime(g.start)}–${fmtTime(g.end)}`).join('  ·  ')
  // Short chip label + full detail (tooltip) for the next-day warning.
  const warnLabel = warning?.startsWith('next day:') ? 'next day busy' : warning ? 'early start tomorrow' : undefined
  // Together chip already conveys mutual time, so drop any "together" reason.
  const factReasons = (reasons ?? []).filter((r) => !/together/i.test(r))

  // Booking: propose the longest mutual-free window, sized to the min date length.
  const longestMutual = mutualGaps.reduce<BusyInterval | null>(
    (best, g) => (!best || g.end.getTime() - g.start.getTime() > best.end.getTime() - best.start.getTime() ? g : best),
    null,
  )
  const propStart = longestMutual?.start
  const propEnd =
    longestMutual && propStart
      ? new Date(Math.min(propStart.getTime() + (dateMinHours ?? 3) * 3_600_000, longestMutual.end.getTime()))
      : undefined
  const canPlan = !!onPlanDate && !!propStart && !!propEnd
  const [confirming, setConfirming] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [planned, setPlanned] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const confirmPlan = async () => {
    if (!onPlanDate || !propStart || !propEnd) return
    setPlanning(true)
    setPlanError(null)
    try {
      await onPlanDate(propStart, propEnd)
      setPlanned(true)
      setConfirming(false)
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : String(e))
    } finally {
      setPlanning(false)
    }
  }

  return (
    <div className="break-inside-avoid rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800 dark:shadow-none">
      <div>
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{fmtDay(date)}</p>
        {info.label && <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{info.label}</p>}
      </div>

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

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon="●">{slots.length === 0 ? 'Fully booked' : allDay ? 'Free all day' : `${fmtDur(freeTotal)} free`}</Chip>
        {partnerBusy &&
          (mutualGaps.length > 0 ? (
            <Chip icon="🤝" title={mutualRanges}>{`${fmtDur(mutualTotal)} together`}</Chip>
          ) : (
            <Chip icon="🤝">no shared time</Chip>
          ))}
        {afterWork && <Chip icon="🌙">free after work</Chip>}
        {warning && (
          <Chip icon="⚠" tone="warn" title={warning}>
            {warnLabel}
          </Chip>
        )}
        {info.note && <Chip icon="🎉">{info.note}</Chip>}
        {factReasons.map((r, i) => (
          <Chip key={i} icon="❤️">
            {r}
          </Chip>
        ))}
      </div>
      {!allDay && slots.length > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">{ranges.join('  ·  ')}</p>
      )}

      {canPlan && (
        <div className="mt-3 text-xs">
          {planned ? (
            <p className="font-medium text-emerald-600 dark:text-emerald-400">
              ❤️ Date booked — {fmtTime(propStart!)}–{fmtTime(propEnd!)}
            </p>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-600 dark:text-slate-300">
                Book {fmtTime(propStart!)}–{fmtTime(propEnd!)}?
              </span>
              <button
                onClick={confirmPlan}
                disabled={planning}
                className="rounded-md bg-pink-500 px-2.5 py-1 font-medium text-pink-950 disabled:opacity-50"
              >
                {planning ? 'Booking…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={planning}
                className="rounded-md bg-slate-200 px-2.5 py-1 text-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              {planError && <span className="text-rose-600 dark:text-rose-400">{planError}</span>}
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="rounded-md bg-pink-500/90 px-2.5 py-1 font-medium text-pink-950"
            >
              ❤️ Plan date
            </button>
          )}
        </div>
      )}

      {events && (
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700/60">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Schedule</p>
          {events.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">Nothing scheduled</p>
          ) : (
            <ul className="space-y-1">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: calendarColors?.get(ev.calendarId ?? '') ?? '#94a3b8' }}
                  />
                  <span className="w-24 shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                    {ev.start?.dateTime
                      ? `${fmtTime(eventStart(ev))}${ev.end?.dateTime ? `–${fmtTime(new Date(ev.end.dateTime))}` : ''}`
                      : 'all day'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{ev.summary ?? '(no title)'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
