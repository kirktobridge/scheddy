# Plan 7 — Time defense: budgets & booking velocity

**Backlog items:** B-15 (time budgets), B-16 (booking velocity)
**Track:** vision

> **Shell update (2026-07-18):** the Budgets surface targets
> [Plan 14](plan-14-shell.md)'s defense rail (B-25) — status rows in words
> with per-row actions — not a `MetricsStats`-pattern card. Engines unchanged;
> land after B-25 so the row pattern exists.

## Vision

Scheddy currently *reports* free time after the calendar has already eaten it.
The inversion: the user declares floors — "≥ 2 free evenings per week", "one
fully clear weekend per month" — and the app plays defense: it warns while
there is still time to act, and can place a protective hold using the existing
POST-only write path.

## Approach

### B-15: budgets

1. **Model** (`src/store/settings.ts`): `budgets: Budget[]` where
   `Budget = { id, name, window: WindowKey | 'weekend-day' | 'clear-weekend',
   min: number, per: 'week' | 'month' }`. Ships empty; UI in a new
   Settings → Budgets panel (reuse the card-grid + `SliderField` patterns).
2. **Evaluation** (`src/lib/budgets.ts`, pure): given the free-slot map that
   FreePage already computes (`byDate`) plus blocked dates, return per-period
   status: `{ budgetId, period, have, need, deficit, candidates }`.
   `candidates` = best remaining days that would satisfy the budget, ranked by
   the existing `rankFreeDays` options.
3. **Surface**: a "Budgets" card in the right-hand metrics rail
   ([src/components/MetricsStats.tsx](../../src/components/MetricsStats.tsx)
   pattern): green/amber/red per budget for the selected month, with the
   deficit spelled out ("this week: 1 of 2 free evenings left").
4. **Defense action**: on a red budget, offer "Protect Thursday evening" —
   `createEvent` with a configurable hold title on a configurable calendar
   (share the `holdTargetCalendarId` setting from Plan 5 / B-07 if that landed;
   otherwise introduce it here). Always explicit, never automatic writes.

### B-16: booking velocity

1. **Snapshot store** (`src/lib/snapshots.ts`, shared with Plan 11): once per
   day on app open, persist `{ date, freeSlotsInHorizon, freeWeekendDays }` to
   IndexedDB. A few bytes/day; cap at ~2 years.
2. **Velocity math** (pure): compare free-slot counts for a fixed future month
   across snapshots → fill rate. Phrase relative to the previous month's
   trajectory: "July is filling ~3× faster than June did; at this pace the
   weekends are gone by Jul 15."
3. **Surface**: one line in the Budgets card (or the month header) when fill
   rate is anomalous; silent otherwise. This is a warning system, not a chart —
   charts belong to Plan 11.

## Files

- New: `src/lib/budgets.ts`, `src/lib/snapshots.ts`,
  `src/pages/settings/BudgetsPanel.tsx`, `src/components/BudgetsCard.tsx`
- Touch: `src/store/settings.ts`, `src/pages/FreePage.tsx`,
  `src/pages/SettingsPage.tsx`
- Tests: `tests/budgets.test.ts`, `tests/snapshots.test.ts`,
  `tests/budgets.mock.test.tsx`

## Testing

- Pure-function unit tests dominate: budget evaluation across week/month
  boundaries, deficit candidates, velocity from synthetic snapshot series.
- Mock test: a budget over the mock dataset renders the correct status and the
  protect action calls `mockCreateEvent`.

## Risks / notes

- Week/month period boundaries need the same `startOfWeek` conventions as the
  week-picks logic — reuse, don't re-derive.
- Velocity needs ≥ ~2 weeks of snapshots before it says anything; the feature
  must degrade to silence gracefully.
- Depends on nothing, but lands nicer after Plan 1 (cache) so budget evaluation
  isn't recomputed against slow fetches.
