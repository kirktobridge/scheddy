# Plan 11 — History: trends & scarcity countdowns

**Backlog items:** B-21
**Track:** vision

## Vision

Metrics are computed per-month and forgotten. Persisting them unlocks the
questions that change behavior: "are free evenings trending down?", "how has
date cadence held up this year?", and the scarcity frame — "11 free Saturdays
left before the end of summer." A year-in-review writes itself from data the
app already fetches.

## Approach

1. **Snapshot store**: shared `src/lib/snapshots.ts` from Plan 7 / B-16 —
   whichever plan lands first builds it. This plan adds a monthly record:
   `{ month, perMetric: Record<key, count>, freeEvenings, freeWeekendDays }`,
   written when a month closes (on first app open in a new month, compute the
   previous month from events — the metrics engine
   [src/lib/metrics.ts](../../src/lib/metrics.ts) already does this for any
   month) and backfilled on demand up to ~12 months via one historical fetch.
2. **Trends** (`src/lib/trends.ts`, pure): month-series per metric, simple
   deltas and 3-month direction ("down 40% since March" = compare to trailing
   average; no statistics theater).
3. **Scarcity countdowns** (pure, computable without history): "N free
   Saturdays until <horizon>" where horizon is end-of-season/year — current
   free-weekend logic projected forward. Cheap and emotionally load-bearing;
   ships first inside this plan.
4. **Surface**:
   - Metrics rail: a countdown line ("8 free Saturdays left this summer") and
     a per-metric sparkline (tiny inline SVG — read the `dataviz` skill before
     building any chart).
   - A "Year" view behind the month selector (or a fourth tab if it outgrows
     that): 12-month bars per metric, best/worst month callouts — the
     year-in-review.
5. **Privacy/consistency**: history stores *counts only*, never event data;
   settings changes (new rules) apply going forward — historical records keep
   the counts as computed at close (recompute-on-demand is possible via
   backfill but not automatic).

## Files

- New: `src/lib/trends.ts`, `src/components/MetricSparkline.tsx`,
  `src/components/YearReview.tsx` (+ `src/lib/snapshots.ts` if Plan 7 hasn't
  landed)
- Touch: `src/components/MetricsStats.tsx`, `src/pages/FreePage.tsx`,
  `src/lib/metrics.ts` (export a "compute month summary" entry point)
- Tests: `tests/trends.test.ts`, `tests/snapshots.test.ts` (shared),
  `tests/yearReview.mock.test.tsx`

## Testing

- Unit: month-close detection (incl. multi-month gaps in app usage → backfill
  the skipped months), delta/direction math, countdown boundaries (season end,
  year end, today-is-Saturday edge).
- Mock test: countdown renders against mock data; sparkline renders from a
  seeded history fixture.

## Risks / notes

- Backfill cost: 12 months of events for the blocking calendars is one
  bounded fetch, but do it lazily behind a "load history" action, not on
  startup.
- IndexedDB survives most, but not all, storage pressure — history is
  best-effort, and Plan 4's export could include it later.
- Ship order inside the plan: countdowns (no storage needed) → monthly
  snapshots → trends/sparklines → year view.
