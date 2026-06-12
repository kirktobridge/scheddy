import { useMemo, useState } from 'react'
import { addMonths, endOfMonth, format, isSameMonth, startOfMonth } from 'date-fns'
import { eventsToBusy } from '../lib/availability'
import { dedupeEvents, matchRule, unbookedEvenings, unbookedWeekendDays } from '../lib/metrics'
import { useSettings } from '../store/settings'
import { useEvents } from '../hooks/useEvents'
import { fmtEventWhen, eventStart } from '../lib/format'
import { ErrorBanner, Spinner } from '../components/Banner'

export default function MetricsPage() {
  const [settings] = useSettings()
  const [monthOffset, setMonthOffset] = useState(0)
  const now = new Date()
  const month = addMonths(startOfMonth(now), monthOffset)
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const isCurrent = isSameMonth(month, now)

  const { events, loading, error } = useEvents(monthStart.getTime(), monthEnd.getTime())

  const deduped = useMemo(() => (events ? dedupeEvents(events) : []), [events])
  const busy = useMemo(() => eventsToBusy(deduped), [deduped])

  const computed = useMemo(() => {
    // For the current month count from now forward ("remaining"); for other
    // months count the whole month.
    const from = isCurrent ? now : monthStart
    const opts = { threshold: settings.freeThreshold, now: from }
    return {
      evenings: unbookedEvenings(busy, settings.windows, from, monthEnd, opts),
      weekendDays: unbookedWeekendDays(busy, settings.windows, from, monthEnd, opts),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, settings.windows, settings.freeThreshold, isCurrent, monthStart.getTime(), monthEnd.getTime()])

  const ruleResults = useMemo(
    () =>
      settings.metricRules.map((rule) => ({
        rule,
        matched: matchRule(deduped, rule).sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime()),
      })),
    [deduped, settings.metricRules],
  )

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button onClick={() => setMonthOffset((o) => o - 1)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300">
          ←
        </button>
        <h1 className="text-xl font-bold">{format(month, 'MMMM yyyy')}</h1>
        <button onClick={() => setMonthOffset((o) => o + 1)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300">
          →
        </button>
      </header>

      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={computed.evenings}
              label={isCurrent ? 'unbooked evenings left' : 'unbooked evenings'}
            />
            <StatCard
              value={computed.weekendDays}
              label={isCurrent ? 'free weekend days left' : 'free weekend days'}
            />
          </div>

          <div className="space-y-3">
            {ruleResults.map(({ rule, matched }) => (
              <details key={rule.id} className="rounded-xl bg-slate-800 p-3">
                <summary className="flex cursor-pointer items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">
                    {rule.icon} {rule.name}
                  </span>
                  <span className="text-2xl font-bold text-emerald-400">{matched.length}</span>
                </summary>
                <ul className="mt-2 space-y-1 border-t border-slate-700 pt-2">
                  {matched.length === 0 && <li className="text-sm text-slate-500">No matches this month.</li>}
                  {matched.map((ev) => (
                    <li key={`${ev.calendarId}/${ev.id}`} className="text-sm">
                      <span className="text-slate-200">{ev.summary}</span>{' '}
                      <span className="text-xs text-slate-400">{fmtEventWhen(ev)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Keyword metrics count events on your selected calendars whose title contains the keyword. Edit rules in
            Settings.
          </p>
        </>
      )}
    </div>
  )
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4 text-center">
      <p className="text-3xl font-bold text-emerald-400">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  )
}
