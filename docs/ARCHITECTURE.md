# Architecture

One-page map for working on scheddy. See [CLAUDE.md](../CLAUDE.md) for
commands/workflow and [BACKLOG.md](BACKLOG.md) for the roadmap.

## Shape

No backend. The browser talks straight to the Google Calendar API with a
GIS-issued OAuth token; everything else (settings, token) is localStorage.
Deployable to any static host; installable as a PWA.

```
Google Calendar API ── src/api/calendar.ts ── src/hooks/useEvents.ts ─┐
        (or src/api/mock.ts when ?mock=1)                            │
                                                                      ▼
   settings (src/store/settings.ts, localStorage) ──▶ pages compose PURE ENGINES:
                                                      src/lib/* (no React, no IO)
                                                                      │
                                                                      ▼
                                              components render the results
```

## Layers

| Layer | Where | Rules |
|-------|-------|-------|
| API | [src/api/calendar.ts](../src/api/calendar.ts), [src/api/mock.ts](../src/api/mock.ts) | Only place that fetches. Every entry point short-circuits to mock fixtures when `isMockMode()`. **POST-only write path**: `createEvent` is the sole mutation; no update/delete exists on purpose. |
| Auth | [src/auth/google.ts](../src/auth/google.ts) | GIS token client; scopes `calendar.readonly` + `calendar.events` only. Token in localStorage, ~1 h expiry, silent refresh with one 401 retry in the API layer. When silent refresh fails, `getAccessToken` throws `AuthRequiredError` → `useEvents` sets `authRequired` → the error banner offers gesture-driven re-auth (`useReauth`). |
| Settings | [src/store/settings.ts](../src/store/settings.ts) | Single `Settings` object via `useSyncExternalStore`; `updateSettings(patch)` persists and notifies. Legacy-shape fixups happen in `loadSettings`. |
| Engines | [src/lib/](../src/lib/) | Pure functions, no React, no IO — the part that must stay unit-testable. New scheduling logic goes here first. |
| Hooks | [src/hooks/](../src/hooks/) | Bridge: fetching (`useEvents`), derived state (`useBusy` busy-interval sets, `useRelationshipOverlays` mutual-free/date candidates, `useMetrics`, `useHorizon`), query lens (`useQueryMode` — range/window state over the canvas), environment (`useMediaQuery` — defaults desktop under jsdom). |
| Pages | [src/pages/](../src/pages/) | Free (main calendar + query layer) and Settings (card grid of panels in [src/pages/settings/](../src/pages/settings/)). [src/App.tsx](../src/App.tsx) swaps between them and hosts the corner controls (refresh + settings gear); there is no tab nav (B-27). The old Check page dissolved into a query lens on the Free canvas (B-24). |
| Components | [src/components/](../src/components/) | Presentational; receive engine outputs as props. |

## Core data flow (Free view)

1. `useEvents` fetches raw `GEvent[]` for [today, horizon] per calendar group
   (blocking, holidays, partner, joint, …).
2. Metric-rule overrides bake in first: `applyRuleOverrides` /
   `buildBusy` ([src/lib/metrics.ts](../src/lib/metrics.ts)) can force-block
   "Free" events or flip all-day handling per keyword rule.
3. Events → merged busy intervals: `eventsToBusy` / `mergeIntervals`
   ([src/lib/availability.ts](../src/lib/availability.ts)). All-day events,
   `transparency: transparent`, and cancelled events don't block (unless
   rules/settings say otherwise).
4. Busy intervals → free slots: `findFreeSlots` scores each configured window
   (morning/afternoon/evening) per day; a window is free when its longest open
   stretch ≥ `freeThreshold` of the window.
5. Slots → picks: `rankFreeDays` (isolation from other commitments, most free
   time, weekend bias, optional partner-busy tiebreak).
6. Relationship mode adds partner/joint busy and computes overlap sets + date
   candidates ([src/lib/relationship.ts](../src/lib/relationship.ts)).
7. Annotations (relative day labels, holiday notes, "free after work",
   next-day warnings): [src/lib/annotate.ts](../src/lib/annotate.ts).

Work calendars are split out before step 4: work events don't make a slot
"partly booked", they relabel it "free after work" (`adjustForWork`).

## Conventions & invariants

- **Date keys** are `yyyy-MM-dd` strings; convert to `Date` via
  `new Date(dateStr + 'T12:00:00')` (noon avoids DST edges). Times flow as
  epoch ms between hooks so dependency arrays compare by value.
- **Timezone**: engine code must work in any TZ; tests pin
  `TZ=America/New_York`.
- **Mock seam**: mock mode is decided once, pre-render, in
  [src/main.tsx](../src/main.tsx) (`?mock=1` → localStorage flag). Tests flip
  the same flag via `renderMock`. Any new API entry point must implement the
  mock branch or mock tests will hit the network path.
- **Design tokens**: user-customizable colors resolve through
  [src/lib/designTokens.ts](../src/lib/designTokens.ts) (`getColor(settings,
  key)`), not hard-coded Tailwind classes, wherever the user can retheme.
- **Desktop-first**: `xl` (1280px) is the supported minimum; narrow layouts
  are frozen (details in CLAUDE.md).

## Gotchas

- FreePage ([src/pages/FreePage.tsx](../src/pages/FreePage.tsx)) is still the
  largest component (~520 lines) but the busy/overlay engines now live in
  `useBusy` + `useRelationshipOverlays` (B-09). Busy-building lives in those
  hooks so overlays and rankings share one computation — don't duplicate it in
  components. Further extraction (slot ranking, day-card assembly) is unplanned.
- `useEvents` keyed by `calendarIds.join(',')` + range ms; passing a fresh
  array literal of the same ids is fine, but unstable ranges cause refetch
  loops. No caching yet (B-01).
- An **explicitly empty** calendar list to `useEvents` means "no events, idle";
  `undefined` means "use blocking calendars, error if none picked".
- Deleting a default window is legal — `settings.windows` is user-owned and
  never re-merged with defaults on load.
