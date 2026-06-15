import { addDays, format, set, startOfDay, startOfMonth } from 'date-fns'
import type { GCalendar, GEvent } from './calendar'
import { DEFAULT_SETTINGS, getSettings, updateSettings, type Settings } from '../store/settings'

// Mock mode lets the app run with seeded fake calendar data instead of Google —
// useful for developing/screenshotting without real credentials. Toggle with
// the `?mock=1` URL param (`?mock=0` turns it off); the choice persists.
const FLAG = 'scheddy.mock'
const BACKUP = 'scheddy.settings.backup'
const STORAGE_KEY = 'scheddy.settings'

export const MOCK_CALENDARS: GCalendar[] = [
  { id: 'mock-personal', summary: 'Personal (mock)', backgroundColor: '#10b981', primary: true, accessRole: 'owner' },
  { id: 'mock-work', summary: 'Work (mock)', backgroundColor: '#6366f1', accessRole: 'owner' },
  { id: 'mock-holidays', summary: 'Holidays (mock)', backgroundColor: '#f59e0b', accessRole: 'reader' },
  { id: 'mock-us', summary: 'Us (mock)', backgroundColor: '#ec4899', accessRole: 'owner' },
  { id: 'mock-partner', summary: 'Ana (mock)', backgroundColor: '#a855f7', accessRole: 'reader' },
]

export const MOCK_SETTINGS: Partial<Settings> = {
  blockingCalendarIds: ['mock-personal', 'mock-work'],
  workCalendarIds: ['mock-work'],
  holidayCalendarIds: ['mock-holidays'],
  dayEventCalendarIds: ['mock-personal', 'mock-work', 'mock-us', 'mock-partner'],
  metricRules: [
    { id: 'trips', name: 'Trips', keyword: 'trip', icon: '✈️', matchDescription: false },
    // Dates live on the shared "Us" calendar — scoped so only those count.
    { id: 'date-nights', name: 'Date nights', keyword: 'Date,date', icon: '❤️', matchDescription: false, calendarIds: ['mock-us'] },
    { id: 'gym', name: 'Gym', keyword: 'gym,workout', icon: '🏋️', matchDescription: false },
  ],
  // Relationship mode wired up so the Free page's "Me & Ana" card is demoable.
  relationshipMode: true,
  partnerName: 'Ana',
  partnerBlockingCalendarIds: ['mock-partner'],
  partnerWorkCalendarIds: ['mock-partner'],
  jointCalendarIds: ['mock-us'],
  dateRuleId: 'date-nights',
  relationshipPanelOpen: true,
}

export function isMockMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

/**
 * Read the `?mock` URL param and flip mock mode on/off. Turning it on backs up
 * the real settings and swaps in mock calendars/rules; turning it off restores
 * the backup. Call once, before rendering.
 */
export function initMockMode(): void {
  if (typeof window === 'undefined') return
  const param = new URLSearchParams(window.location.search).get('mock')
  if (param === null) return
  const want = param !== '0' && param !== 'false'
  const active = isMockMode()
  try {
    if (want && !active) {
      localStorage.setItem(BACKUP, localStorage.getItem(STORAGE_KEY) ?? JSON.stringify(getSettings()))
      localStorage.setItem(FLAG, '1')
      updateSettings({ ...DEFAULT_SETTINGS, ...MOCK_SETTINGS })
    } else if (!want && active) {
      localStorage.setItem(FLAG, '0')
      const backup = localStorage.getItem(BACKUP)
      if (backup) {
        localStorage.setItem(STORAGE_KEY, backup)
        updateSettings(JSON.parse(backup) as Partial<Settings>)
      }
    }
  } catch {
    // localStorage unavailable — nothing to persist.
  }
}

const iso = (day: Date, h: number, m = 0) =>
  set(day, { hours: h, minutes: m, seconds: 0, milliseconds: 0 }).toISOString()
const ymd = (day: Date) => format(day, 'yyyy-MM-dd')

/** Seeded events anchored to "today" so they always land in the visible range. */
function buildEvents(): GEvent[] {
  const today = startOfDay(new Date())
  const monthStart = startOfMonth(today)
  const out: GEvent[] = []
  let n = 0
  const add = (e: Omit<GEvent, 'id' | 'iCalUID'>) => {
    const id = `mock-${n++}`
    out.push({ id, iCalUID: id, ...e })
  }
  const timed = (cal: string, summary: string, day: Date, sh: number, eh: number) =>
    add({ summary, calendarId: cal, start: { dateTime: iso(day, sh) }, end: { dateTime: iso(day, eh) } })
  const allDay = (cal: string, summary: string, start: Date, days: number) =>
    add({ summary, calendarId: cal, start: { date: ymd(start) }, end: { date: ymd(addDays(start, days)) } })

  // Two trips: one early this month (likely in the trimmed past weeks — exercises
  // the "counted but not highlighted" edge case) and one upcoming and multi-day.
  allDay('mock-personal', 'Trip to Portland', addDays(monthStart, 2), 4)
  allDay('mock-personal', 'Trip to Tokyo', addDays(today, 10), 5)

  // Date-night rule matches. Dates live on the shared "Us" calendar; one in the
  // past (exercises the "last date" look-back) and one upcoming (the "next").
  timed('mock-us', 'Date night 🍷', addDays(today, -17), 18, 22)
  timed('mock-us', 'Dinner date', addDays(today, 18), 19, 22)
  // A personal "date" that must NOT count — it's off the scoped calendar.
  timed('mock-personal', 'Coffee date', addDays(today, 12), 15, 16)

  // Ana's calendar: weekday work + a weekend away, so overlap/off-days have signal.
  for (let d = -21; d < 56; d++) {
    const day = addDays(today, d)
    const dow = day.getDay()
    if (dow >= 1 && dow <= 5) timed('mock-partner', 'Ana — work', day, 9, 17)
  }
  allDay('mock-partner', 'Ana — visiting family', addDays(today, 24), 2)

  // Gym rule matches (comma keyword: gym OR workout).
  timed('mock-personal', 'Morning gym', addDays(today, 1), 7, 8)
  timed('mock-personal', 'Workout', addDays(today, 8), 18, 19)

  // Recurring-ish work meetings to make the availability bars meaningful.
  for (let d = 0; d < 56; d++) {
    const day = addDays(today, d)
    const dow = day.getDay()
    if (dow >= 1 && dow <= 5) {
      timed('mock-work', 'Standup', day, 9, 10)
      if (d % 2 === 0) timed('mock-work', 'Design review', day, 13, 15)
    }
  }

  // A holiday next week.
  allDay('mock-holidays', 'Public holiday', addDays(today, 7), 1)

  return out
}

let cache: { day: string; events: GEvent[] } | null = null
function allEvents(): GEvent[] {
  const day = ymd(startOfDay(new Date()))
  if (!cache || cache.day !== day) cache = { day, events: buildEvents() }
  return cache.events
}

function instants(ev: GEvent): [number, number] {
  if (ev.start?.dateTime) return [new Date(ev.start.dateTime).getTime(), new Date(ev.end?.dateTime ?? ev.start.dateTime).getTime()]
  const start = new Date((ev.start?.date ?? '') + 'T00:00:00').getTime()
  const end = new Date((ev.end?.date ?? ev.start?.date ?? '') + 'T00:00:00').getTime()
  return [start, end]
}

/** Mock replacement for createEvent: append to the seeded cache so it shows on refresh. */
export function mockCreateEvent(
  calendarId: string,
  event: { summary: string; description?: string; start: { dateTime: string }; end: { dateTime: string } },
): GEvent {
  const id = `mock-new-${Date.now()}`
  const ev: GEvent = { id, iCalUID: id, calendarId, ...event }
  allEvents().push(ev)
  return ev
}

/** Mock replacement for listEventsMulti: filter seeded events to the window + calendars. */
export function mockEventsMulti(calendarIds: string[], timeMin: Date, timeMax: Date): GEvent[] {
  const ids = new Set(calendarIds)
  const min = timeMin.getTime()
  const max = timeMax.getTime()
  return allEvents().filter((ev) => {
    if (!ev.calendarId || !ids.has(ev.calendarId)) return false
    const [s, e] = instants(ev)
    return s < max && e > min
  })
}
