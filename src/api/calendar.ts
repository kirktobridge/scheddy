import { getAccessToken, clearToken } from '../auth/google'

const BASE = 'https://www.googleapis.com/calendar/v3'

export interface GEvent {
  id: string
  iCalUID?: string
  summary?: string
  description?: string
  status?: string
  transparency?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  calendarId?: string
}

export interface GCalendar {
  id: string
  summary: string
  backgroundColor?: string
  primary?: boolean
  accessRole?: string
}

async function gfetch<T>(path: string, params: Record<string, string>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken()
    const url = new URL(BASE + path)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401 && attempt === 0) {
      clearToken()
      continue
    }
    if (!res.ok) throw new Error(`Google Calendar API error ${res.status}: ${await res.text()}`)
    return (await res.json()) as T
  }
  throw new Error('unreachable')
}

interface Paged<T> {
  items?: T[]
  nextPageToken?: string
}

export async function listCalendars(): Promise<GCalendar[]> {
  const out: GCalendar[] = []
  let pageToken: string | undefined
  do {
    const page = await gfetch<Paged<GCalendar>>('/users/me/calendarList', {
      maxResults: '250',
      ...(pageToken ? { pageToken } : {}),
    })
    out.push(...(page.items ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return out
}

export async function listEvents(calendarId: string, timeMin: Date, timeMax: Date): Promise<GEvent[]> {
  const out: GEvent[] = []
  let pageToken: string | undefined
  do {
    const page = await gfetch<Paged<GEvent>>(`/calendars/${encodeURIComponent(calendarId)}/events`, {
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: '2500',
      ...(pageToken ? { pageToken } : {}),
    })
    out.push(...(page.items ?? []).map((ev) => ({ ...ev, calendarId })))
    pageToken = page.nextPageToken
  } while (pageToken)
  return out
}

export async function listEventsMulti(calendarIds: string[], timeMin: Date, timeMax: Date): Promise<GEvent[]> {
  const results = await Promise.all(calendarIds.map((id) => listEvents(id, timeMin, timeMax)))
  return results.flat()
}
