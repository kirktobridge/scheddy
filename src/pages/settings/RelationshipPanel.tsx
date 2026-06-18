import type { GCalendar } from '../../api/calendar'
import Section from '../../components/Section'
import type { Settings } from '../../store/settings'
import { INPUT, type Update } from './shared'

export default function RelationshipPanel({
  settings,
  update,
  calendars,
}: {
  settings: Settings
  update: Update
  calendars: GCalendar[] | null
}) {
  // Calendars a date can be written to (you must be able to edit them).
  const writable = (calendars ?? []).filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer')
  const targetFallback = settings.jointCalendarIds[0] ?? settings.blockingCalendarIds[0] ?? ''
  return (
    <>
      <Section title="Relationship mode">
        <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
          Enable relationship mode
          <input
            type="checkbox"
            checked={settings.relationshipMode}
            onChange={(e) => update({ relationshipMode: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <p className="text-xs text-slate-500">
          Adds "off days", "overlap", and "date" overlays to the Scheduler tab, plus a partner/joint calendar section on
          the Calendars page. Overlap and date-candidate settings live under Metrics → Advanced metrics.
        </p>
        {settings.relationshipMode && (
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Partner name
            <input
              type="text"
              value={settings.partnerName}
              onChange={(e) => update({ partnerName: e.target.value })}
              placeholder="Partner"
              className={`w-40 px-2 py-1 text-sm ${INPUT}`}
            />
          </label>
        )}
      </Section>

      {settings.relationshipMode && (
        <Section title="Book a date">
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Add dates to
            <select
              value={settings.dateTargetCalendarId || targetFallback}
              onChange={(e) => update({ dateTargetCalendarId: e.target.value })}
              className={`max-w-[60%] truncate px-2 py-1 ${INPUT}`}
            >
              {writable.length === 0 && <option value="">(sign in to pick a calendar)</option>}
              {writable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Event title
            <input
              type="text"
              value={settings.dateEventTitle}
              onChange={(e) => update({ dateEventTitle: e.target.value })}
              placeholder="Date ❤️"
              className={`w-44 px-2 py-1 text-sm ${INPUT}`}
            />
          </label>
          <p className="text-xs text-slate-500">
            "Plan date" on a day creates a {settings.dateMinHours}h event in your shared free window. Keep a date keyword
            in the title so that week stops being suggested. Booking needs calendar write access — if it fails, sign out
            and back in on the Account page to grant it.
          </p>
        </Section>
      )}
    </>
  )
}
