# Plan 10 — Rituals: cadence targets for every rule

**Backlog items:** B-20
**Track:** vision

> **Shell update (2026-07-18):** the rhythm-line surface lands in
> [Plan 14](plan-14-shell.md)'s defense rail (B-25) as first-class status
> rows — not tooltips/badges on StatCards. `rituals.ts` is unaffected.

## Vision

`dateCadenceDays` is a special case of a general pattern: recurring
commitments with a target rhythm — "friends every 3 weeks", "call mom weekly",
"gym 3×/week". Each keyword rule can carry a cadence; the metrics panel stops
being a scoreboard and becomes a gentle backlog of relationships and habits,
each with an overdue state and a *suggested next slot*.

## Approach

1. **Model**: extend `MetricRule`
   ([src/store/settings.ts](../../src/store/settings.ts)) with optional
   `cadence?: { every: number, unit: 'days' | 'weeks', count?: number }`
   (`count` for "3× per week" style). Undefined = today's behavior, so all
   existing rules are untouched.
2. **Engine** (`src/lib/rituals.ts`, pure — generalizing what
   FreePage's `dateNudge` does for the one date rule):
   - Per rule: last match, next scheduled match, days since, overdue flag —
     `lastDateEvent` / `nextDateEvent` in
     [src/lib/relationship.ts](../../src/lib/relationship.ts) generalize
     directly (they already operate on matched events).
   - Suggested next slot: run the rule's scope through the existing candidate
     ranking (`rankFreeDays` for solo rules; `rankDateCandidates` when the rule
     is the date rule) constrained to "before it becomes overdue".
3. **Scan**: the year-back `dateScan` in FreePage becomes a shared
   rules-with-cadence scan covering the union of cadenced rules' calendars —
   one fetch, not one per rule. (Plan 1's cache makes this cheap; without it,
   still a single extra stream.)
4. **Surface**:
   - Metrics rail: rules with cadence show a rhythm line under the count —
     "last: 9 days ago · due in 5" with the existing overdue styling from the
     date nudge; tap → jumps the calendar to the suggested day.
   - The existing date-cadence UI in Settings → Relationship migrates to a
     per-rule cadence editor in the Metrics panel; `dateCadenceDays` folds in
     via the settings migration (Plan 4's `settingsVersion` if landed, else a
     one-off load-time fold like `colors → tokens`).
5. **Booking**: reuse the quick-block flow (Plan 5 / B-07) with the rule's
   name as default title, so "book the next one" is one tap. Without B-07,
   suggestion-only is still valuable.

## Files

- New: `src/lib/rituals.ts`
- Touch: `src/store/settings.ts`, `src/lib/relationship.ts` (export/rename the
  generalized helpers), `src/pages/FreePage.tsx`,
  `src/components/MetricsStats.tsx`, `src/pages/settings/MetricsPanel.tsx`
- Tests: `tests/rituals.test.ts`, extend `tests/metrics.test.ts` fixtures,
  `tests/rituals.mock.test.tsx`

## Testing

- Unit: overdue math across units (`every 3 weeks`, `3× per week` needs
  per-period counting, not just last-seen), suggestion stays before the due
  date, rules without cadence produce nothing.
- Migration test: legacy `dateCadenceDays` settings blob loads into the date
  rule's `cadence`.
- Mock test: cadenced rule renders rhythm line; overdue rule shows overdue
  state.

## Risks / notes

- "3× per week" is a different shape from "every N days" (period quota vs
  interval); implement interval first, quota second — both fit the `cadence`
  model above.
- Don't let this grow guilt mechanics: overdue is a soft nudge (existing amber
  styling), never a streak counter.
- Best after Plan 5 Stage 1 (hooks extraction) so the scan/nudge logic moves
  out of FreePage rather than deeper into it.
