# Plan 1 — Data layer: cache, freshness, batching

**Backlog items:** B-01 (event cache), B-02 (visibility refresh), B-10 (batch fetches)

## Problem

Every app open refetches everything. [src/hooks/useEvents.ts](../../src/hooks/useEvents.ts)
holds events in per-component state, so FreePage's ~7 `useEvents` streams
(blocking, holidays, day-events, partner, partner-work, joint, date-scan) each
fetch independently — overlapping calendars are fetched multiple times, and the
date scan re-pulls a full year of history on every mount. Switching tabs
Free → Check → Free triggers a full refetch. Separately, `nowMs` is frozen at
mount ([src/pages/FreePage.tsx:49](../../src/pages/FreePage.tsx#L49)), so an
installed PWA left open overnight shows stale slots until manual Refresh.

## Approach

### B-01: cache module with stale-while-revalidate

New `src/api/eventCache.ts`:

- In-memory `Map` keyed `${calendarId}|${timeMinISO}|${timeMaxISO}` holding
  `{ events, fetchedAt }`. Keys are stable within a day because all ranges
  derive from `startOfDay`.
- Persistence to IndexedDB (hand-rolled ~40-line wrapper, no new dependency;
  `localStorage` is a fallback but event payloads can exceed its quota).
- API: `getCached(key)` (sync), `store(key, events)`, `evictOlderThan(ms)`.

Wire into `listEventsMulti` / `useEvents`:

- On mount, serve cached events synchronously (`loading: false`, flag
  `stale: true`), then kick a background refetch and swap in fresh data.
- Per-calendar granularity so two hooks requesting overlapping calendar sets
  share fetches: dedupe in-flight requests with a promise map (same key while
  pending returns the same promise).
- TTL: treat cache older than ~15 min as stale-but-showable; older than 24 h as
  evictable. Manual Refresh bypasses cache.
- Mock mode (`isMockMode()`) bypasses the cache entirely so tests stay
  deterministic.

### B-02: `useNow` hook + visibility refresh

New `src/hooks/useNow.ts`: returns `nowMs`, bumps it on
`document.visibilitychange` (when becoming visible and > 5 min elapsed) and on a
30-min interval. FreePage replaces its `useState(Date.now())` with this hook;
the existing effect chain already refetches when `nowMs` shifts the range keys.
The Refresh button keeps its explicit bump.

### B-10: batch endpoint (stretch, do last)

Replace `Promise.all(calendarIds.map(listEvents))` in `listEventsMulti` with a
single `multipart/mixed` POST to `https://www.googleapis.com/batch/calendar/v3`
(max 50 inner requests — fine here). Keep the per-calendar path as fallback and
for pagination continuation (batched responses with `nextPageToken` fall back
to sequential paging, which is rare for these window sizes). If the multipart
parsing proves brittle, drop B-10 — B-01's dedupe already removes most
duplicate traffic.

## Files

- `src/api/eventCache.ts` (new), `src/hooks/useNow.ts` (new)
- `src/api/calendar.ts`, `src/hooks/useEvents.ts`, `src/pages/FreePage.tsx`
- `tests/eventCache.test.ts` (new), `tests/useNow.test.ts` (new)

## Testing

- Unit: cache get/store/TTL/eviction; in-flight dedupe (two concurrent calls,
  one fetch); `useNow` with fake timers + synthetic `visibilitychange`.
- Existing mock harness suite must stay green (mock mode bypasses cache).
- Manual: `?mock=0` real-data run — first load fetches, reload paints instantly
  from cache then refreshes; airplane-mode reload still paints.

## Risks / notes

- IndexedDB is async; first paint from cache needs a small hydration step
  (read persisted cache before first render or accept one flash on cold start).
- Cache must be invalidated after `createEvent` (booking a date) — evict keys
  containing the target calendar, then refetch (the existing `planDate` already
  calls `refresh()`).
- Do B-01 and B-02 together (B-02 is trivial once ranges rekey off `useNow`);
  B-10 is independent and optional.
