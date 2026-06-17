import type { GCalendar } from '../../api/calendar'
import Section from '../../components/Section'
import { normalizeRankOrder, resolveDateRule } from '../../lib/relationship'
import type { DateRankFactor, Settings } from '../../store/settings'
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
          Adds "off days", "overlap", and "date" overlays to the Free tab, plus a partner/joint calendar section on the
          Calendars page.
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
        <Section title="Overlap">
          <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
            Overlap threshold (hours)
            <input
              type="number"
              min={0}
              max={24}
              value={settings.overlapMinHours}
              onChange={(e) => update({ overlapMinHours: Math.min(24, Math.max(0, Number(e.target.value) || 0)) })}
              className={`w-20 px-2 py-1 text-right ${INPUT}`}
            />
          </label>
          <p className="text-xs text-slate-500">Minimum shared free time for a day to count toward the "Our Overlap" highlight.</p>
        </Section>
      )}

      {settings.relationshipMode && (
        <Section title="Date picking">
          <p className="text-xs text-slate-500">How the ❤️ date candidates are chosen and ranked.</p>
          <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
            Minimum date length (hours)
            <input
              type="number"
              min={0}
              max={24}
              value={settings.dateMinHours}
              onChange={(e) => update({ dateMinHours: Math.min(24, Math.max(0, Number(e.target.value) || 0)) })}
              className={`w-20 px-2 py-1 text-right ${INPUT}`}
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
            Date candidates to show
            <input
              type="number"
              min={1}
              max={10}
              value={settings.dateCandidateCount}
              onChange={(e) => update({ dateCandidateCount: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
              className={`w-20 px-2 py-1 text-right ${INPUT}`}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Prefer days {settings.partnerName || 'partner'} is off work
            <input
              type="checkbox"
              checked={settings.dateFavorPartnerOff}
              onChange={(e) => update({ dateFavorPartnerOff: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Favor times {settings.partnerName || 'partner'} is busy for my Top picks
            <input
              type="checkbox"
              checked={settings.freeFavorPartnerBusy}
              onChange={(e) => update({ freeFavorPartnerBusy: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <p className="text-xs text-slate-500">
            Nudges the ★ Top free-day picks toward windows {settings.partnerName || 'partner'} is already busy,
            so your shared-free time stays open. Soft tiebreaker — it never overrides a clearly more open day.
          </p>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Day preference
            <select
              value={settings.datePreference}
              onChange={(e) => update({ datePreference: e.target.value as Settings['datePreference'] })}
              className={`px-2 py-1 ${INPUT}`}
            >
              <option value="weekend">Prefer weekends</option>
              <option value="weekday">Prefer weekdays</option>
              <option value="either">No preference</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            "Date" events come from
            <select
              value={resolveDateRule(settings.metricRules, settings.dateRuleId)?.id ?? ''}
              onChange={(e) => update({ dateRuleId: e.target.value })}
              className={`px-2 py-1 ${INPUT}`}
            >
              {settings.metricRules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.name || r.keyword || r.id}
                </option>
              ))}
            </select>
          </label>
          <RankPriority settings={settings} update={update} />
          <p className="text-xs text-slate-500">
            Candidates are ranked by the priority above (drag-free reorder with the arrows), one per week, never
            back-to-back. A week that already has a matching event is skipped (edit keyword rules on the Metrics page).
          </p>
        </Section>
      )}

      {settings.relationshipMode && (
        <Section title="Cadence">
          <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
            Nudge when overdue (days, 0 = off)
            <input
              type="number"
              min={0}
              max={365}
              value={settings.dateCadenceDays}
              onChange={(e) => update({ dateCadenceDays: Math.min(365, Math.max(0, Number(e.target.value) || 0)) })}
              className={`w-20 px-2 py-1 text-right ${INPUT}`}
            />
          </label>
        </Section>
      )}

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

/** Reorderable list that sets the date-ranking factor precedence. */
function RankPriority({ settings, update }: { settings: Settings; update: Update }) {
  const order = normalizeRankOrder(settings.dateRankOrder)
  const partner = settings.partnerName || 'Partner'
  const labels: Record<DateRankFactor, string> = {
    partnerOff: `${partner}'s days off`,
    isolation: 'Most open calendar (spacing)',
    dayType: 'Day preference',
    overlap: 'Most shared free time',
  }
  // Factors whose own control is currently off contribute nothing wherever they sit.
  const inactive: Record<DateRankFactor, boolean> = {
    partnerOff: !settings.dateFavorPartnerOff,
    isolation: settings.isolationWindowDays <= 0,
    dayType: settings.datePreference === 'either',
    overlap: false,
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    update({ dateRankOrder: next })
  }
  return (
    <div className="space-y-1">
      <span className="text-sm text-slate-700 dark:text-slate-300">Ranking priority</span>
      {order.map((f, i) => (
        <div
          key={f}
          className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm shadow-sm dark:bg-slate-800 dark:shadow-none"
        >
          <span className="w-4 text-center text-xs text-slate-400">{i + 1}</span>
          <span className="flex-1 text-slate-700 dark:text-slate-300">
            {labels[f]}
            {inactive[f] && <span className="ml-1 text-xs text-slate-400">· off</span>}
          </span>
          <button
            onClick={() => move(i, -1)}
            disabled={i === 0}
            aria-label={`Move ${labels[f]} up`}
            className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            ↑
          </button>
          <button
            onClick={() => move(i, 1)}
            disabled={i === order.length - 1}
            aria-label={`Move ${labels[f]} down`}
            className="rounded px-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            ↓
          </button>
        </div>
      ))}
    </div>
  )
}
