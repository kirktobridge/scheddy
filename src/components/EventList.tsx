import type { GEvent } from '../api/calendar'
import { eventStart, fmtEventWhen } from '../lib/format'

export default function EventList({ events }: { events: GEvent[] }) {
  const sorted = [...events].sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
  if (sorted.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">Nothing booked.</p>
  }
  return (
    <ul className="space-y-1.5">
      {sorted.map((ev) => (
        <li
          key={`${ev.calendarId}/${ev.id}`}
          className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-slate-800/60 dark:shadow-none"
        >
          <p className="text-sm text-slate-800 dark:text-slate-200">{ev.summary ?? '(no title)'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{fmtEventWhen(ev)}</p>
        </li>
      ))}
    </ul>
  )
}
