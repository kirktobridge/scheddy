import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EVICT_MS,
  STALE_MS,
  _resetMemory,
  cacheKey,
  dedupe,
  evictCalendar,
  evictOlderThan,
  getCached,
  isStale,
  store,
} from '../src/api/eventCache'
import type { GEvent } from '../src/api/calendar'
import { getCachedEventsMulti } from '../src/api/calendar'

const ev = (id: string, calendarId: string): GEvent => ({ id, calendarId })
const min = new Date('2026-01-01T00:00:00.000Z')
const max = new Date('2026-01-08T00:00:00.000Z')

afterEach(() => {
  _resetMemory()
  vi.useRealTimers()
})

describe('eventCache — key + store/get', () => {
  it('key is stable and range-scoped', () => {
    expect(cacheKey('cal', min, max)).toBe('cal|2026-01-01T00:00:00.000Z|2026-01-08T00:00:00.000Z')
    expect(cacheKey('cal', min, max)).not.toBe(cacheKey('other', min, max))
  })

  it('round-trips events with a fetch timestamp', () => {
    const key = cacheKey('cal', min, max)
    store(key, [ev('a', 'cal')], 1000)
    const entry = getCached(key)
    expect(entry?.events).toHaveLength(1)
    expect(entry?.fetchedAt).toBe(1000)
    expect(getCached('missing')).toBeUndefined()
  })
})

describe('eventCache — staleness + eviction', () => {
  it('isStale flips after the soft TTL', () => {
    const entry = { events: [], fetchedAt: 0 }
    expect(isStale(entry, STALE_MS)).toBe(false)
    expect(isStale(entry, STALE_MS + 1)).toBe(true)
  })

  it('evictOlderThan drops only entries past the age', () => {
    const now = 1_000_000_000
    store(cacheKey('fresh', min, max), [ev('a', 'fresh')], now)
    store(cacheKey('old', min, max), [ev('b', 'old')], now - EVICT_MS - 1)
    evictOlderThan(EVICT_MS, now)
    expect(getCached(cacheKey('fresh', min, max))).toBeDefined()
    expect(getCached(cacheKey('old', min, max))).toBeUndefined()
  })

  it('evictCalendar drops every range for one calendar only', () => {
    store(cacheKey('cal-a', min, max), [ev('a', 'cal-a')])
    store(cacheKey('cal-a', max, min), [ev('a2', 'cal-a')])
    store(cacheKey('cal-b', min, max), [ev('b', 'cal-b')])
    evictCalendar('cal-a')
    expect(getCached(cacheKey('cal-a', min, max))).toBeUndefined()
    expect(getCached(cacheKey('cal-a', max, min))).toBeUndefined()
    expect(getCached(cacheKey('cal-b', min, max))).toBeDefined()
  })
})

describe('eventCache — in-flight de-dupe', () => {
  it('coalesces concurrent calls into one fetch', async () => {
    let calls = 0
    let resolveFetch!: (v: GEvent[]) => void
    const fn = () => {
      calls++
      return new Promise<GEvent[]>((r) => {
        resolveFetch = r
      })
    }
    const p1 = dedupe('k', fn)
    const p2 = dedupe('k', fn)
    expect(p1).toBe(p2)
    expect(calls).toBe(1)
    resolveFetch([ev('a', 'cal')])
    expect(await p1).toHaveLength(1)
    // Once settled, the key is free again for a new fetch.
    const p3 = dedupe('k', fn)
    expect(calls).toBe(2)
    resolveFetch([])
    await p3
  })
})

describe('getCachedEventsMulti', () => {
  it('combines events only when every calendar is cached', () => {
    store(cacheKey('cal-a', min, max), [ev('a', 'cal-a')])
    // cal-b not cached yet → whole set is a miss
    expect(getCachedEventsMulti(['cal-a', 'cal-b'], min, max)).toBeNull()
    store(cacheKey('cal-b', min, max), [ev('b', 'cal-b')])
    const hit = getCachedEventsMulti(['cal-a', 'cal-b'], min, max)
    expect(hit?.events.map((e) => e.id).sort()).toEqual(['a', 'b'])
    expect(hit?.stale).toBe(false)
  })

  it('flags stale when any entry is past the soft TTL', () => {
    vi.useFakeTimers()
    const t0 = Date.now()
    store(cacheKey('cal-a', min, max), [ev('a', 'cal-a')], t0)
    store(cacheKey('cal-b', min, max), [ev('b', 'cal-b')], t0 - STALE_MS - 1)
    expect(getCachedEventsMulti(['cal-a', 'cal-b'], min, max)?.stale).toBe(true)
  })

  it('returns null for an empty calendar set', () => {
    expect(getCachedEventsMulti([], min, max)).toBeNull()
  })
})
