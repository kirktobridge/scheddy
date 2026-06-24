import type { GCalendar } from '../../api/calendar'
import Section from '../../components/Section'
import SliderField from '../../components/SliderField'
import { getColor } from '../../lib/designTokens'
import { normalizeRankOrder, resolveDateRule } from '../../lib/relationship'
import type { DateRankFactor, MetricRule, Settings } from '../../store/settings'
import { INPUT, INPUT_NESTED, type Update } from './shared'

export default function MetricsPanel({
  settings,
  update,
  blockingCalendars,
}: {
  settings: Settings
  update: Update
  blockingCalendars: GCalendar[] | null
}) {
  const updateRule = (id: string, patch: Partial<MetricRule>) =>
    update({ metricRules: settings.metricRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const rel = settings.relationshipMode
  const partner = settings.partnerName || 'partner'

  return (
    <>
      <Section title="Metric keywords">
        {settings.metricRules.map((rule) => (
          <div key={rule.id} className="space-y-2 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800 dark:shadow-none">
            <div className="flex gap-2">
              <input
                type="text"
                value={rule.icon}
                onChange={(e) => updateRule(rule.id, { icon: e.target.value })}
                className={`w-12 px-2 py-1 text-center text-sm ${INPUT_NESTED}`}
                aria-label="Icon"
              />
              <input
                type="text"
                value={rule.name}
                onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                placeholder="Metric name"
                className={`flex-1 px-2 py-1 text-sm ${INPUT_NESTED}`}
              />
              <button
                onClick={() => update({ metricRules: settings.metricRules.filter((r) => r.id !== rule.id) })}
                className="rounded-lg bg-rose-500/20 px-2 text-sm text-rose-600 dark:text-rose-300"
                aria-label={`Delete ${rule.name}`}
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={rule.keyword}
                onChange={(e) => updateRule(rule.id, { keyword: e.target.value })}
                placeholder="Keywords (comma-separated)"
                className={`flex-1 px-2 py-1 text-sm ${INPUT_NESTED}`}
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={rule.matchDescription}
                  onChange={(e) => updateRule(rule.id, { matchDescription: e.target.checked })}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                + description
              </label>
            </div>
            <RuleScope
              rule={rule}
              calendars={blockingCalendars}
              settings={settings}
              onChange={(calendarIds) => updateRule(rule.id, { calendarIds })}
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={!!rule.blocking}
                onChange={(e) => updateRule(rule.id, { blocking: e.target.checked })}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              Matching events block time (even if marked "Free")
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              All-day matches
              <select
                value={rule.allDay ?? 'inherit'}
                onChange={(e) =>
                  updateRule(rule.id, {
                    allDay: e.target.value === 'inherit' ? undefined : (e.target.value as 'block' | 'free'),
                  })
                }
                className={`px-2 py-1 ${INPUT_NESTED}`}
              >
                <option value="inherit">Use global setting</option>
                <option value="block">Always block time</option>
                <option value="free">Never block time</option>
              </select>
            </label>
          </div>
        ))}
        <button
          onClick={() =>
            update({
              metricRules: [
                ...settings.metricRules,
                { id: crypto.randomUUID(), name: '', keyword: '', icon: '📌', matchDescription: false },
              ],
            })
          }
          className="w-full rounded-lg border border-dashed border-slate-400 py-2 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400"
        >
          + Add metric
        </button>
      </Section>

      <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Advanced metrics</h2>
        <p className="text-xs text-slate-500">
          Non-keyword metrics: the ★ Top free-day picks{rel ? ', ⇄ overlap and ❤️ date candidates' : ''}.
        </p>
      </div>

      <Section title="Top picks">
        <SliderField
          label="Top days to highlight"
          value={settings.freeSlotCount}
          min={0}
          max={10}
          format={(v) => String(v)}
          onChange={(v) => update({ freeSlotCount: v })}
        />
        <SliderField
          label="Top picks this week"
          value={settings.freeSlotCountWeek}
          min={0}
          max={7}
          format={(v) => String(v)}
          onChange={(v) => update({ freeSlotCountWeek: v })}
        />
        <SliderField
          label="Spacing window"
          value={settings.isolationWindowDays}
          min={0}
          max={7}
          format={(v) => `± ${v} day${v === 1 ? '' : 's'}`}
          onChange={(v) => update({ isolationWindowDays: v })}
        />
        <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
          Favor weekends
          <input
            type="checkbox"
            checked={settings.favorWeekends}
            onChange={(e) => update({ favorWeekends: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <p className="text-xs text-slate-500">
          Picks prefer days with the most empty calendar within ± this many days, then the most free time, then
          weekends.
        </p>
      </Section>

      {rel && (
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

      {rel && (
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
            Prefer days {partner} is off work
            <input
              type="checkbox"
              checked={settings.dateFavorPartnerOff}
              onChange={(e) => update({ dateFavorPartnerOff: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
            Favor times {partner} is busy for my Top picks
            <input
              type="checkbox"
              checked={settings.freeFavorPartnerBusy}
              onChange={(e) => update({ freeFavorPartnerBusy: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <p className="text-xs text-slate-500">
            Nudges the ★ Top free-day picks toward windows {partner} is already busy, so your shared-free time stays
            open. Soft tiebreaker — it never overrides a clearly more open day.
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
            back-to-back. A week that already has a matching event is skipped (edit keyword rules above).
          </p>
        </Section>
      )}

      {rel && (
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
    </>
  )
}

/** Per-rule "scope" disclosure: which calendars the rule counts on (empty = all). */
function RuleScope({
  rule,
  calendars,
  settings,
  onChange,
}: {
  rule: MetricRule
  calendars: GCalendar[] | null
  settings: Settings
  onChange: (calendarIds: string[] | undefined) => void
}) {
  const selected = rule.calendarIds ?? []
  const all = selected.length === 0
  const summary = all
    ? 'All calendars'
    : `${selected.length} calendar${selected.length === 1 ? '' : 's'}`

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]
    onChange(next.length ? next : undefined)
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-slate-500 dark:text-slate-400">
        Scope: <span className="text-slate-700 dark:text-slate-300">{summary}</span>
      </summary>
      <div className="mt-1 space-y-1 pl-1">
        {calendars === null ? (
          <p className="text-slate-500">Loading calendars…</p>
        ) : calendars.length === 0 ? (
          <p className="text-slate-500">Check a blocking calendar on the Calendars page first.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={all}
                onChange={() => onChange(undefined)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300">All calendars</span>
            </label>
            {calendars.map((cal) => (
              <label key={cal.id} className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={selected.includes(cal.id)}
                  onChange={() => toggle(cal.id)}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cal.backgroundColor ?? getColor(settings, 'calendar.fallback') }}
                />
                <span className="text-slate-700 dark:text-slate-300">{cal.summary}</span>
              </label>
            ))}
          </>
        )}
      </div>
    </details>
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
