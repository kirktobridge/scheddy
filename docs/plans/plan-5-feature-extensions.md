# Plan 5 — Feature extensions: shared availability & quick-block

**Backlog items:** B-09 (FreePage extraction — prerequisite), B-06 (relationship
mode on Check), B-07 (quick-block a slot)

> **Shell update (2026-07-18):** Stage 2's *surface* moved — the "Both of us"
> toggle lands in [Plan 14](plan-14-shell.md)'s query-layer mode bar on the
> canvas, not on a separate Check page. The engine work below (partner
> streams through `useBusy`, mutual slot computation) is unchanged. Stage 1
> (B-09) is now also Plan 14's hard prerequisite — land it first.

## Problem

- [src/pages/FreePage.tsx](../../src/pages/FreePage.tsx) is 659 lines with the
  busy-interval and relationship-overlay computation inlined as ~15 chained
  `useMemo`s. The logic can't be reused (Check page needs it) or unit-tested in
  isolation.
- Check answers "am I free?" but not "are *we* free?" even with relationship
  mode fully configured — the overlap math already exists in
  [src/lib/relationship.ts](../../src/lib/relationship.ts).
- The only write action is booking a date. Users can see a great free slot but
  can't hold it without leaving the app; the POST-only write path
  ([src/api/calendar.ts:100](../../src/api/calendar.ts#L100)) already supports
  this safely.

## Approach — three stages, each shippable

### Stage 1 (B-09): extract hooks from FreePage — ✅ shipped 2026-07-18

New hooks, moving existing code without behavior change:

- `src/hooks/useBusy.ts` — takes the event streams (personal/partner/joint),
  reads settings itself, returns
  `{ busyOpts, workBusy, nonWorkBusy, combinedBusy, jointBusy, partnerBusy, nonWorkEvents }`.
  (`busyOpts`/`nonWorkEvents` are also returned because the overlays and the
  slot-booking labels still need them.)
- `src/hooks/useRelationshipOverlays.ts` — the big `relationship` memo:
  overlap sets, date candidates, reasons. Takes the busy streams + partnerWork
  events + dateMatches + {startMs, lookahead, selectedMonth}.
- Kept `FreeCalendar`-specific bits (layers, highlight unions), the free-day
  ranking, and slot/day-card assembly in the page.

Shipped: FreePage 663 → 520 lines; verbatim move, no behavior change. Full mock
suite passes unchanged (freeRegression is the net); added `tests/useBusy.test.ts`
to pin the extraction. `/simplify` intentionally skipped — Stage 1 is a verbatim
move, so improving the moved logic here would violate the "land it alone"
constraint.

**Stages 2 (B-06) and 3 (B-07) remain open.**

### Stage 2 (B-06): "Both of us" on Check

- When `settings.relationshipMode` is on, CheckPage shows a two-chip toggle:
  **Just me / Both of us** (default: just me).
- "Both of us" fetches partner + joint streams for the selected range (reuse
  `useEvents` with the partner calendar IDs, as FreePage does) and merges
  partner busy into the slot computation via the extracted `useBusy` pieces —
  free slots become *mutual* free slots.
- The "Already booked" list gains the partner's events, tagged with
  `partnerName`.
- No new settings; reuses `partnerBlockingCalendarIds` / `jointCalendarIds`.

### Stage 3 (B-07): quick-block from the day panel

- In [src/components/DayTimelineCard.tsx](../../src/components/DayTimelineCard.tsx),
  next to the existing "Plan date" flow, each free slot gets a **Hold**
  action (works in solo mode too, unlike Plan date).
- Small inline form: title (default "Hold"), start/end pre-filled from the slot
  and editable, target calendar dropdown (default: new setting
  `holdTargetCalendarId`, falling back to first blocking calendar).
- Reuses `createEvent`; on success, refresh the affected streams and show the
  same page-level confirmation pattern as `bookedMsg`.
- New settings: `holdTargetCalendarId: string`, `holdEventTitle: string` —
  surfaced in Settings → Calendars panel.

## Files

- New: `src/hooks/useBusy.ts`, `src/hooks/useRelationshipOverlays.ts`
- `src/pages/FreePage.tsx`, `src/pages/CheckPage.tsx`,
  `src/components/DayTimelineCard.tsx`, `src/components/EventList.tsx`,
  `src/store/settings.ts`, `src/pages/settings/CalendarsPanel.tsx`
- Tests: `tests/useBusy.test.ts`, `tests/checkTogether.mock.test.tsx`,
  `tests/quickHold.mock.test.tsx` (new); existing suite guards Stage 1.

## Testing

- Stage 1: no new tests required — the existing mock suite is the regression
  net; add unit tests for `useBusy` where extraction makes them cheap.
- Stage 2: mock test — relationship mode on, toggle "Both of us", slot list
  shrinks to mutual-free windows (mock dataset already has partner calendars).
- Stage 3: mock test — Hold on a slot calls `mockCreateEvent` with the slot
  times and shows confirmation.

## Risks / notes

- Stage 1 is the risk concentrator: move code verbatim, resist improving it in
  the same commit.
- Stage 2's fetch volume on Check grows (partner calendars per range change) —
  Plan 1's cache, if landed first, absorbs this; otherwise acceptable.
- Order within plan: 1 → 2 → 3; stages 2 and 3 are independent of each other.
