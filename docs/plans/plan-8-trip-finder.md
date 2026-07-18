# Plan 8 — Trip finder: multi-day gap search

**Backlog items:** B-17
**Track:** vision

> **Shell update (2026-07-18):** the "Getaway" surface is a query-layer mode
> on the unified canvas ([Plan 14](plan-14-shell.md) / B-24), not a
> Check-page third mode. Run cards render in the left rail; runs highlight as
> date *spans* on the calendar (needs a range-capable `OverlayLayer` style).
> The `trips.ts` engine is unaffected.

## Vision

The availability engine thinks in morning/afternoon/evening windows within a
single day. The highest-stakes couple question is multi-day: "when can we get
away for 3 days?" Answering it today means manually paging through months of
calendar. A consecutive-day mode turns that into one query.

## Approach

1. **Engine** (`src/lib/trips.ts`, pure, mirroring
   [src/lib/availability.ts](../../src/lib/availability.ts) conventions):
   `findFreeRuns(busy, from, to, opts)` → runs of ≥ N consecutive days where
   each day's blocking load is under a "day is expendable" threshold.
   - A day counts as free for trip purposes when its busy time within waking
     hours is below a configurable ceiling (default: zero timed events;
     optional lenient mode ignores events under ~1 h — dentist ≠ trip blocker).
   - Relationship mode: run against `mergeIntervals([...myBusy, ...partnerBusy,
     ...jointBusy])` — mutual runs only. The busy inputs already exist
     (Plan 5's `useBusy` extraction is the natural provider).
2. **Ranking**: prefer runs containing a weekend (fewer leave days — compute
   `leaveDaysNeeded` per run), then isolation from adjacent commitments
   (reuse `dayIsolation`), then earliest.
3. **Surface — Check page third mode**: alongside presets/month/custom, a
   "Getaway" mode: length stepper (2–14 days), search horizon (defaults to
   `maxHorizonDays`), optional "Both of us" (shares Plan 5 / B-06's toggle if
   present). Results as run cards: date span, leave days needed, what borders
   the run ("back-to-back with Labor Day weekend"), holiday notes via the
   existing `holidayNote`.
4. **Actions per run**: select-in-calendar (jump the Free view to that month),
   and — once Plan 9 lands — "share these dates".

## Files

- New: `src/lib/trips.ts`, `src/components/TripRunCard.tsx`
- Touch: `src/pages/CheckPage.tsx`
- Tests: `tests/trips.test.ts` (heavy), `tests/tripFinder.mock.test.tsx`

## Testing

- Unit: run detection across busy patterns (weekend-bridging, run split by one
  midday event in strict vs lenient mode, holiday adjacency, partner merge
  shrinking runs), leave-day math for runs crossing weekends.
- Mock test: Getaway mode over the mock dataset returns deterministic runs.

## Risks / notes

- All-day events need care: `blockAllDayEvents=false` (default) means an
  all-day "trip already booked" entry wouldn't block a suggested trip — trip
  search should probably always treat all-day events as blocking, independent
  of the slot-level setting. Decide in implementation, document in UI copy.
- Fetch horizon: trip search wants the full `maxHorizonDays` span even when the
  Free view horizon is shorter; reuse `useEvents` with its own range (cache
  from Plan 1 absorbs the extra fetch).
- Prerequisite: none hard; Plan 5 Stage 1 (`useBusy`) avoids duplicating busy
  assembly, so land it first if possible.
