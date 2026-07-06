# Plan 12 — What-if: preview an event's impact

**Backlog items:** B-22
**Track:** vision

## Vision

Before saying yes to an invite, see the price: "this kills your last free
weekend in July and pushes date night 3 weeks overdue." The entire pipeline is
pure functions over event lists, so simulation is
`recompute([...events, hypothetical])` diffed against current state — very
little new machinery for a very distinctive feature.

## Approach

1. **Input**: a "What if…" action (Free view, near the top picks) opening a
   minimal sketch form: title (optional), date, start/end — same field
   patterns as the quick-block form (Plan 5 / B-07). One event at a time;
   recurring hypotheticals are out of scope.
2. **Simulation** (`src/lib/whatIf.ts`, pure): given current events + the
   hypothetical, recompute through the existing engines and return a
   **structured diff**, not two full states:
   - free slots lost (the hypothetical's day and knock-on threshold changes),
   - top-picks changes (days dropping out of `rankFreeDays`),
   - budget impacts (Plan 7, if landed),
   - relationship impacts: mutual-free days lost, date candidates lost
     (`useRelationshipOverlays` inputs re-run with the extra busy interval),
   - cadence impact (Plan 10, if landed): "date night window this week
     disappears".
   Each engine is already pure; the module composes them and diffs the sets.
3. **Surface**: while a hypothetical is active, the calendar shows ghost mode —
   the hypothetical event hatched on its day, lost picks/candidates struck
   with a subtle red tint (a new `OverlayLayer` style), and a summary card in
   the left rail listing the diff in words. "Clear" exits; nothing is ever
   written.
4. **Entry shortcut**: prefill from a selected free slot's times ("what if
   this gets booked?") — one tap from the day card.

## Files

- New: `src/lib/whatIf.ts`, `src/components/WhatIfCard.tsx`
- Touch: `src/pages/FreePage.tsx`, `src/components/FreeCalendar.tsx` (ghost
  overlay style)
- Tests: `tests/whatIf.test.ts`, `tests/whatIf.mock.test.tsx`

## Testing

- Unit: diff correctness — hypothetical that removes a top pick, one that
  doesn't change anything ("free" verdict), one that flips a threshold
  (partly-booked → not free), relationship-mode candidate loss.
- Mock test: activating a hypothetical over mock data strikes the expected
  day and shows the summary; clearing restores exactly.

## Risks / notes

- Performance: one extra full recompute per hypothetical edit; the memo graph
  already recomputes on settings changes at acceptable cost. Debounce the form.
- Hard prerequisite: Plan 5 Stage 1 (B-09) — without the extracted hooks the
  simulation would duplicate FreePage's inline memo chain.
- Degrades gracefully: without Plans 7/10 the diff simply has fewer sections.
- This is also B-23's most important tool ("can I take a call Thursday 6pm?"),
  so its structured-diff output should be JSON-friendly from day one.
