# Plan 3 — Navigation: URL state & keyboard

**Backlog items:** B-03 (hash routing / deep links), B-13 (calendar keyboard nav)

## Problem

- The active tab is plain `useState` ([src/App.tsx:17](../../src/App.tsx#L17)):
  every reload lands on Free, browser back/forward do nothing, and there is no
  way to link to "Check, June 20–25".
- On the calendar grid, Escape clears the selection but arrow keys don't move
  it — weak keyboard support for a desktop-first app.

## Approach

### B-03: hash routing (no router dependency)

- URL scheme: `#/free`, `#/check`, `#/settings`;
  Check encodes its mode in query params:
  `#/check?preset=weekend`, `#/check?month=2026-08`,
  `#/check?from=2026-06-20&to=2026-06-25`, plus `windows=morning,evening`.
- New `src/hooks/useHashRoute.ts`: parses `location.hash` into
  `{ tab, params }`, subscribes to `hashchange`, exposes `navigate(tab, params?)`
  which pushes a new hash (history entries → back/forward work).
- `App.tsx` derives `tab` from the hook instead of `useState`; invalid/empty
  hash falls back to `free` (preserves current behavior for existing PWA
  installs).
- `CheckPage` initializes `mode` / `customStart` / `customEnd` / `windowFilter`
  from the params and writes them back on change (replace-state, not push, for
  param tweaks so back doesn't step through every chip click).
- Free view's selected day/month stay out of the URL for now — they're
  ephemeral; add later if wanted.

### B-13: roving tabindex on the calendar grid

In [src/components/FreeCalendar.tsx](../../src/components/FreeCalendar.tsx):

- Day cells become focusable via roving tabindex: the selected day (else today)
  has `tabIndex=0`, all others `-1`.
- `onKeyDown` on the grid: arrows move focus ±1 / ±7 days, Home/End jump to
  week edges, PageUp/PageDown change month (reusing the existing
  `onSelectMonth`), Enter/Space select the focused day. Escape already handled
  at page level.
- Focus style: reuse the existing selection ring token with a distinct
  `focus-visible` outline so pointer users see no change.
- Skip cells beyond `maxDate` / before today consistent with click behavior.

## Files

- `src/hooks/useHashRoute.ts` (new)
- `src/App.tsx`, `src/pages/CheckPage.tsx`, `src/components/FreeCalendar.tsx`
- `tests/hashRoute.test.ts` (new), keyboard test in
  `tests/freeInteractions.mock.test.tsx`

## Testing

- Unit: hash parse/serialize round-trips; unknown hash → `free`.
- Mock tests: setting `location.hash = '#/check?preset=weekend'` before render
  lands on Check with the weekend chip active; arrow-key navigation moves the
  focused cell and Enter opens the day panel.
- Manual: back/forward between tabs; paste a `#/check?from=…&to=…` URL.

## Risks / notes

- jsdom supports `hashchange`; keep the hook's parsing pure so it's testable
  without events.
- The two items are independent — B-03 can ship without B-13.
