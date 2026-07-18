import type { GEvent } from './calendar'

/**
 * Event cache for the calendar API (B-01). Keyed per-calendar-per-range so hooks
 * that request overlapping calendar sets share fetches. Two TTLs:
 *   - STALE_MS: still showable, but trigger a background revalidate.
 *   - EVICT_MS: too old to show; dropped on eviction sweeps.
 * In-memory `Map` is the source of truth; IndexedDB is a best-effort persistence
 * layer so a cold PWA start can paint before the network resolves. Both layers
 * are optional — with no IndexedDB (node/jsdom tests) the memory map alone works.
 */

export const STALE_MS = 15 * 60 * 1000
export const EVICT_MS = 24 * 60 * 60 * 1000

export interface CacheEntry {
  events: GEvent[]
  fetchedAt: number
}

/** Stable within a day because all ranges derive from `startOfDay`. */
export function cacheKey(calendarId: string, timeMin: Date, timeMax: Date): string {
  return `${calendarId}|${timeMin.toISOString()}|${timeMax.toISOString()}`
}

const mem = new Map<string, CacheEntry>()

export function getCached(key: string): CacheEntry | undefined {
  return mem.get(key)
}

export function isStale(entry: CacheEntry, now = Date.now()): boolean {
  return now - entry.fetchedAt > STALE_MS
}

export function store(key: string, events: GEvent[], fetchedAt = Date.now()): void {
  const entry: CacheEntry = { events, fetchedAt }
  mem.set(key, entry)
  void idbPut(key, entry)
}

/** Drop entries whose age exceeds `ageMs` (defaults to the evictable TTL). */
export function evictOlderThan(ageMs = EVICT_MS, now = Date.now()): void {
  for (const [k, v] of mem) if (now - v.fetchedAt > ageMs) mem.delete(k)
  void idbSweep((v) => now - v.fetchedAt > ageMs)
}

/** Invalidate every range for one calendar — used after a booking mutates it. */
export function evictCalendar(calendarId: string): void {
  const prefix = calendarId + '|'
  for (const k of mem.keys()) if (k.startsWith(prefix)) mem.delete(k)
  void idbSweepKeys((k) => k.startsWith(prefix))
}

/** Test hook: wipe the in-memory layer (does not touch IndexedDB). */
export function _resetMemory(): void {
  mem.clear()
  inflight.clear()
}

// --- In-flight de-duplication ------------------------------------------------

const inflight = new Map<string, Promise<GEvent[]>>()

/**
 * Coalesce concurrent fetches for the same key: while a request is pending, later
 * callers get the same promise instead of issuing a duplicate network request.
 */
export function dedupe(key: string, fn: () => Promise<GEvent[]>): Promise<GEvent[]> {
  const existing = inflight.get(key)
  if (existing) return existing
  const p = fn().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

// --- IndexedDB persistence (best-effort, ~40 lines, no dependency) -----------

const DB_NAME = 'scheddy'
const STORE = 'events'
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === 'undefined') return null
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function tx(mode: IDBTransactionMode): Promise<IDBObjectStore | null> {
  const db = await openDb()?.catch(() => null)
  if (!db) return null
  return db.transaction(STORE, mode).objectStore(STORE)
}

async function idbPut(key: string, entry: CacheEntry): Promise<void> {
  const s = await tx('readwrite')
  s?.put(entry, key)
}

/** Load all persisted entries into memory. Call once before first render. */
export async function hydrate(now = Date.now()): Promise<void> {
  const s = await tx('readonly')
  if (!s) return
  await new Promise<void>((resolve) => {
    const req = s.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return resolve()
      const entry = cursor.value as CacheEntry
      // Skip entries too old to show; leave the sweep to remove them from disk.
      if (now - entry.fetchedAt <= EVICT_MS && !mem.has(cursor.key as string)) {
        mem.set(cursor.key as string, entry)
      }
      cursor.continue()
    }
    req.onerror = () => resolve()
  })
}

async function idbSweep(pred: (v: CacheEntry) => boolean): Promise<void> {
  const s = await tx('readwrite')
  if (!s) return
  const req = s.openCursor()
  req.onsuccess = () => {
    const cursor = req.result
    if (!cursor) return
    if (pred(cursor.value as CacheEntry)) cursor.delete()
    cursor.continue()
  }
}

async function idbSweepKeys(pred: (k: string) => boolean): Promise<void> {
  const s = await tx('readwrite')
  if (!s) return
  const req = s.openCursor()
  req.onsuccess = () => {
    const cursor = req.result
    if (!cursor) return
    if (pred(cursor.key as string)) cursor.delete()
    cursor.continue()
  }
}
