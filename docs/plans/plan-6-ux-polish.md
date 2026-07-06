# Plan 6 — UX polish

**Backlog items:** B-11 (loading skeleton), B-12 (first-run onboarding),
B-14 (mock-mode badge)

## Problem

Three small friction points:

- Every load shows a full-page `<Spinner />` even though the calendar layout is
  fully known ahead of data ([src/pages/FreePage.tsx:594](../../src/pages/FreePage.tsx#L594)).
- A brand-new user's first screen is the string "Pick your calendars in
  Settings first." styled as an **error**
  ([src/hooks/useEvents.ts:27](../../src/hooks/useEvents.ts#L27)) — the app's
  worst moment is the first impression.
- `?mock=1` demo data is visually identical to real data; easy to confuse
  during dev or when showing the app to someone.

## Approach

### B-11: calendar skeleton

- New `src/components/CalendarSkeleton.tsx`: the month header, weekday row, and
  a 5×7 grid of pulsing placeholder cells (Tailwind `animate-pulse`), matching
  `FreeCalendar` dimensions so there is no layout shift when data lands.
- FreePage renders it in place of `<Spinner />` on the Free view **only on cold
  load** (`events === null`); background refreshes keep showing current data
  (with Plan 1 landed, cold loads become rare — the skeleton is the fallback).
- CheckPage keeps the spinner (its result area is small and variable).

### B-12: first-run onboarding

- Detect the state in FreePage: error is the "no calendars picked" case
  (after Plan 2 this is a discriminated error kind — `{ kind: 'setup' }`;
  before Plan 2, match on the required-selection case in `useEvents`).
- Replace the error banner with a welcome card: one-line app description, the
  2-step path ("Sign in with Google → pick which calendars block your time"),
  and a **Open Settings** button (switches tab via the existing `setTab`
  plumbing — or `navigate('settings')` once Plan 3 lands).
- Show a variant when signed in but zero blocking calendars picked ("Almost
  there — pick calendars").

### B-14: mock badge

- When `isMockMode()` ([src/api/mock.ts](../../src/api/mock.ts)), render a
  small amber "demo data" chip pinned bottom-right (`fixed`, above the mobile
  nav's z-index), title-attribute explaining `?mock=0` turns it off.
- Lives in `App.tsx` so it covers every tab. One-time check at render is fine —
  mock mode is decided before first render in `main.tsx`.

## Files

- New: `src/components/CalendarSkeleton.tsx`
- `src/pages/FreePage.tsx`, `src/App.tsx`, `src/hooks/useEvents.ts` (setup
  error kind), `src/components/Banner.tsx`
- Tests: extend `tests/freeView.mock.test.tsx` (badge, skeleton on cold load),
  new `tests/onboarding.mock.test.tsx`

## Testing

- Mock render tests: mock mode shows the badge; empty
  `blockingCalendarIds` renders the welcome card with a working Open Settings
  button; cold load renders skeleton before data resolves.
- Manual screenshot pass (Playwright, per CLAUDE.md) for the skeleton's
  layout-shift check in both themes.

## Risks / notes

- All three items are independent; land in any order, individually.
- B-12 interacts with Plan 2's error-shape change — if Plan 2 ships first, use
  its `kind` field; if not, do the string-free detection now and simplify later.
