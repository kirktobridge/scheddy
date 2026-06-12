import { useMemo, useState } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { eventsToBusy, findFreeSlots } from '../lib/availability'
import { useSettings } from '../store/settings'
import { useEvents } from '../hooks/useEvents'
import SlotList from '../components/SlotList'
import { ErrorBanner, Spinner } from '../components/Banner'

const LOOKAHEAD_DAYS = 60

export default function FreePage() {
  const [settings] = useSettings()
  // Refresh recomputes "now" too, so stale slots disappear on pull.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const startMs = startOfDay(new Date(nowMs)).getTime()
  const endMs = addDays(new Date(startMs), LOOKAHEAD_DAYS).getTime()

  const { events, loading, error, refresh } = useEvents(startMs, endMs)

  const slots = useMemo(() => {
    if (!events) return []
    const busy = eventsToBusy(events)
    return findFreeSlots(busy, settings.windows, new Date(startMs), new Date(endMs), {
      threshold: settings.freeThreshold,
      now: new Date(nowMs),
    }).slice(0, settings.freeSlotCount)
  }, [events, settings.windows, settings.freeThreshold, settings.freeSlotCount, startMs, endMs, nowMs])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Next {settings.freeSlotCount} free slots</h1>
        <button
          onClick={() => {
            setNowMs(Date.now())
            void refresh()
          }}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 active:bg-slate-700"
        >
          ↻ Refresh
        </button>
      </header>
      {error && <ErrorBanner message={error} />}
      {loading && <Spinner />}
      {!loading && !error && (
        <SlotList slots={slots} emptyText={`No free slots in the next ${LOOKAHEAD_DAYS} days. Busy life!`} />
      )}
    </div>
  )
}
