import { Fragment, useState } from 'react'
import type { GCalendar } from '../../api/calendar'
import CellToggle from '../../components/CellToggle'
import Section from '../../components/Section'
import {
  allDayOn,
  blocksAny,
  roleOf,
  toggleAllDay,
  toggleBlocking,
  toggleDayEvents,
  toggleHoliday,
  toggleHorizon,
  toggleJoint,
  togglePartnerBlocking,
  togglePartnerWork,
  toggleWork,
} from '../../lib/calendarRoles'
import { getColor } from '../../lib/designTokens'
import type { Settings } from '../../store/settings'
import { INPUT, type Update } from './shared'

export default function CalendarsPanel({
  signedIn,
  calendars,
  settings,
  update,
}: {
  signedIn: boolean
  calendars: GCalendar[] | null
  settings: Settings
  update: Update
}) {
  const [query, setQuery] = useState('')
  // Auto-by-role row groups; "Unused" starts collapsed. Ephemeral (not persisted).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['unused']))
  const [legendOpen, setLegendOpen] = useState(false)

  if (!signedIn) {
    return <p className="text-sm text-slate-500">Sign in on the Account page first to pick calendars.</p>
  }
  if (!calendars) return <p className="text-sm text-slate-500">Loading calendars…</p>

  const has = (
    field:
      | 'blockingCalendarIds'
      | 'workCalendarIds'
      | 'holidayCalendarIds'
      | 'dayEventCalendarIds'
      | 'horizonCalendarIds',
    id: string,
  ) => settings[field].includes(id)

  const hasIn = (field: 'partnerBlockingCalendarIds' | 'partnerWorkCalendarIds' | 'jointCalendarIds', id: string) =>
    settings[field].includes(id)

  const q = query.trim().toLowerCase()
  const shown = q ? calendars.filter((c) => c.summary.toLowerCase().includes(q)) : calendars

  const rel = settings.relationshipMode

  type Col = {
    key: string
    label: string
    help: string
    active: (id: string) => boolean
    disabled: (id: string) => boolean
    toggle: (id: string) => void
  }
  const youCols: Col[] = [
    {
      key: 'blocking',
      label: 'Blocks time',
      help: 'events here mark you busy.',
      active: (id) => has('blockingCalendarIds', id),
      disabled: () => false,
      toggle: (id) => update(toggleBlocking(settings, id)),
    },
    {
      key: 'work',
      label: 'Work',
      help: 'still busy, but evenings with only work read "free after work" on the Free tab (needs Blocks time).',
      active: (id) => has('workCalendarIds', id),
      disabled: (id) => !has('blockingCalendarIds', id),
      toggle: (id) => update(toggleWork(settings, id)),
    },
    {
      key: 'holiday',
      label: 'Holiday',
      help: 'adds notes like "2 days before Memorial Day". Tip: subscribe to "Holidays in United States" in Google Calendar.',
      active: (id) => has('holidayCalendarIds', id),
      disabled: () => false,
      toggle: (id) => update(toggleHoliday(settings, id)),
    },
    {
      key: 'dayEvents',
      label: 'Show events',
      help: "list this calendar's events in the selected-day schedule on the Free tab.",
      active: (id) => has('dayEventCalendarIds', id),
      disabled: () => false,
      toggle: (id) => update(toggleDayEvents(settings, id)),
    },
    {
      key: 'horizon',
      label: 'Horizon',
      help: 'the latest event here sets how far ahead the Free tab looks (bounded by the min/max in Availability).',
      active: (id) => has('horizonCalendarIds', id),
      disabled: () => false,
      toggle: (id) => update(toggleHorizon(settings, id)),
    },
    {
      key: 'allDay',
      label: 'All-day',
      help: 'count this calendar’s all-day events as busy (e.g. a "Vacation" or "Anniversary" day), even with the global all-day setting off.',
      active: (id) => allDayOn(settings, id),
      disabled: (id) => settings.blockAllDayEvents || !blocksAny(settings, id),
      toggle: (id) => update(toggleAllDay(settings, id)),
    },
  ]
  const relCols: Col[] = [
    {
      key: 'pBlocking',
      label: 'Partner busy',
      help: "your partner's calendars; used to find mutual free time and space out date picks.",
      active: (id) => hasIn('partnerBlockingCalendarIds', id),
      disabled: () => false,
      toggle: (id) => update(togglePartnerBlocking(settings, id)),
    },
    {
      key: 'pWork',
      label: 'Partner work',
      help: 'drives the "off work" overlay on the Free tab (needs Partner busy).',
      active: (id) => hasIn('partnerWorkCalendarIds', id),
      disabled: (id) => !hasIn('partnerBlockingCalendarIds', id),
      toggle: (id) => update(togglePartnerWork(settings, id)),
    },
    {
      key: 'joint',
      label: 'Joint',
      help: 'shared events that block both of you (e.g. a couples calendar).',
      active: (id) => hasIn('jointCalendarIds', id),
      disabled: () => false,
      toggle: (id) => update(toggleJoint(settings, id)),
    },
  ]
  const cols = rel ? [...youCols, ...relCols] : youCols
  const relStart = relCols[0].key

  const groups = (
    [
      { key: 'blocking', label: 'Blocking' },
      { key: 'other', label: 'Other roles' },
      { key: 'unused', label: 'Unused' },
    ] as const
  )
    .map((g) => ({ ...g, cals: shown.filter((c) => roleOf(settings, c.id) === g.key) }))
    .filter((g) => g.cals.length > 0)

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <Section title="Calendars">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search calendars…"
        className={`w-full px-3 py-2 text-sm ${INPUT}`}
      />
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">No calendars match "{query}".</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 bg-slate-100 px-3 py-2 text-left font-medium text-slate-500 dark:bg-slate-900"
                >
                  Calendar
                </th>
                <th
                  colSpan={youCols.length}
                  className="px-2 py-1.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  You
                </th>
                {rel && (
                  <th
                    colSpan={relCols.length}
                    className="border-l border-slate-200 px-2 py-1.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-slate-700"
                  >
                    {settings.partnerName.trim() || 'Relationship'}
                  </th>
                )}
              </tr>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    title={`${c.label} — ${c.help}`}
                    className={`px-2 py-1.5 text-center align-bottom text-xs font-medium whitespace-nowrap text-slate-600 dark:text-slate-300 ${
                      rel && c.key === relStart ? 'border-l border-slate-200 dark:border-slate-700' : ''
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const open = !collapsed.has(g.key)
                return (
                  <Fragment key={g.key}>
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <th colSpan={1 + cols.length} scope="colgroup" className="sticky left-0 px-1 py-1 text-left">
                        <button
                          onClick={() => toggleGroup(g.key)}
                          aria-expanded={open}
                          className="flex w-full items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
                        >
                          <span className="text-[10px]">{open ? '▾' : '▸'}</span>
                          {g.label}
                          <span className="font-normal text-slate-400">({g.cals.length})</span>
                        </button>
                      </th>
                    </tr>
                    {open &&
                      g.cals.map((cal) => (
                        <tr key={cal.id} className="border-t border-slate-100 dark:border-slate-800">
                          <th
                            scope="row"
                            className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-normal dark:bg-slate-800"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: cal.backgroundColor ?? getColor(settings, 'calendar.fallback') }}
                              />
                              <span className="min-w-0 max-w-[40vw] truncate text-slate-800 dark:text-slate-200">
                                {cal.summary}
                              </span>
                            </span>
                          </th>
                          {cols.map((c) => (
                            <td
                              key={c.key}
                              className={`px-2 py-1.5 text-center ${
                                rel && c.key === relStart ? 'border-l border-slate-100 dark:border-slate-800' : ''
                              }`}
                            >
                              <CellToggle
                                active={c.active(cal.id)}
                                disabled={c.disabled(cal.id)}
                                onToggle={() => c.toggle(cal.id)}
                                label={`${cal.summary} — ${c.label}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-1 text-xs text-slate-500">
        <button
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400"
        >
          <span className="text-[10px]">{legendOpen ? '▾' : '▸'}</span>
          What do these mean?
        </button>
        {legendOpen && (
          <div className="space-y-1 pt-2">
            {cols.map((c) => (
              <p key={c.key}>
                <strong className="text-slate-600 dark:text-slate-400">{c.label}</strong> — {c.help}
              </p>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
