# Plan 2 — Resilience & auth UX

**Backlog items:** B-05 (error boundary), B-08 (auth expiry banner)

## Problem

- A render crash anywhere produces a white screen with no recovery path — there
  is no error boundary in the tree ([src/App.tsx](../../src/App.tsx)).
- When the stored token expires and silent refresh needs interaction,
  `getAccessToken` ([src/auth/google.ts:106](../../src/auth/google.ts#L106))
  triggers Google Identity Services from a non-user-gesture code path. Result:
  a surprise Google popup mid-browse, or a blocked popup that surfaces as a raw
  error string in the banner.

## Approach

### B-05: error boundary

New `src/components/ErrorBoundary.tsx` (class component — React still requires
one for `componentDidCatch`):

- Wraps the page content in `App.tsx` (inside `<main>`, so the nav survives and
  the user can still reach Settings).
- Fallback UI: error message, "Reload app" button (`location.reload()`), and a
  "Reset settings" escape hatch behind a confirm (clears `scheddy.settings` —
  covers the corrupted-settings crash class).

### B-08: typed auth errors + sign-in banner

1. In `src/auth/google.ts`, add `class AuthRequiredError extends Error`.
   `getAccessToken` throws it when there is no valid stored token **and** the
   silent request fails (GIS `error_callback` or `error` response), instead of
   letting the generic failure propagate.
2. `useEvents` catches it and sets a discriminated error state:
   `{ kind: 'auth' } | { kind: 'other', message }` (keep a `message` string for
   backward compatibility during the change).
3. `ErrorBanner` gains an `onSignIn` variant: "Session expired — sign in again"
   with a button that calls `signIn()` (a real user gesture, so the popup is
   allowed), then `refresh()`.
4. Keep the existing behavior where a valid-looking stored token is used
   optimistically and a 401 retries once ([src/api/calendar.ts:32](../../src/api/calendar.ts#L32));
   only the *interactive* fallback changes.

## Files

- `src/components/ErrorBoundary.tsx` (new)
- `src/App.tsx`, `src/auth/google.ts`, `src/hooks/useEvents.ts`,
  `src/components/Banner.tsx`
- Pages that render `<ErrorBanner message={error} />` (FreePage, CheckPage,
  hooks' consumers) — adjust to the new error shape.
- `tests/authErrors.test.ts` (new), boundary test in a `*.mock.test.tsx`.

## Testing

- Unit: `getAccessToken` with expired stored token + failing silent request
  throws `AuthRequiredError`; other failures don't.
- Mock render test: component that throws inside the boundary renders fallback;
  nav still present.
- Manual: clear `scheddy.token` in devtools with valid settings → banner with
  sign-in button appears, no popup until clicked.

## Risks / notes

- GIS "silent" requests (`prompt: ''`) can still open a popup when a session
  exists but consent is stale; acceptable — the goal is eliminating the
  *failure* case, not every popup.
- Small and self-contained: do this plan first, it protects everything that
  follows.
