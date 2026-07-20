# Project Journal

Reverse-chronological record of major changes, for lookback — the story of
the project, not the commit log. One entry per shipped chunk of work (a
backlog item, a redesign, a process change), written at product altitude:
*what changed and why*, in 1–3 sentences. Git history holds the details.

Maintained by the **ship** skill's close-out step; work that lands outside
`ship` gets an entry too (see CLAUDE.md → Workflow). The entry format is
enforced by [tests/docsSchema.test.ts](../tests/docsSchema.test.ts).

Entry format:

```markdown
## YYYY-MM-DD — Short title
Refs: B-nn, plan-N (omit line if none)

What changed and why, 1–3 sentences.
```

---

## 2026-07-20 — Dissolve Check into a query lens on the canvas
Refs: B-24, plan-14

The standalone "Am I free?" Check page is gone; its controls (preset/month/custom
range, window filter, and a new relationship-mode "Both of us" chip) now live in a
mode bar atop the Free calendar. An active query dims the canvas outside its range,
rings the matching days, and lists the free slots — with a defensive one-line
summary — in the left rail, so answering "when are we free?" never leaves the map.
First step of the Plan 14 shell that the vision track lands on.

---

## 2026-07-18 — Extract busy/overlay engines from FreePage
Refs: B-09, plan-5

FreePage's inlined busy-interval and relationship-overlay computation moved
verbatim into `useBusy` and `useRelationshipOverlays` (page shrank 663 → 520
lines), so the logic is now unit-testable and reusable by the Check view and the
upcoming canvas shell. Pure refactor — no behavior change; the mock regression
suite passes unchanged.

---

## 2026-07-18 — Auth expiry: "sign in again" banner
Refs: B-08, plan-2

An expired session used to fail silent-refresh from a non-gesture code path,
producing a surprise/blocked Google popup or a raw error string. Now a typed
`AuthRequiredError` flows up to a "Session expired — sign in again" banner whose
button re-auths inside the click (a gesture Google honors) and re-fetches, on
both the Scheduler and Check views.

---

## 2026-07-18 — App-level error boundary with recovery
Refs: B-05, plan-2

A render crash used to leave a white screen with no way out; now an
`ErrorBoundary` around the page content catches it and offers "Reload app" and
a "Reset settings" escape hatch (clears corrupted `scheddy.settings`), while the
nav stays mounted so other tabs remain reachable.

---

## 2026-07-18 — UI design review → shell restructure plan
Refs: B-24…B-27, plan-14

A first-principles review of the vision track against the current UI
(distilled into docs/VISION.md) concluded the app should converge on one
persistent canvas + query layer + defense rail, with modes as lenses rather
than tabs. Captured as Plan 14 (B-24 dissolve Check, B-25 defense rail, B-26
canvas persistence, B-27 retire tab nav), surface re-pointing notes in plans
3/5/6/7/8/9/10/11/13, and a re-derived suggested order.

## 2026-07-18 — Event cache + self-refreshing clock
Refs: B-01, B-02, plan-1

Fetched events now flow through a shared cache (`api/eventCache.ts`): per-
calendar keys let FreePage's many `useEvents` streams dedupe overlapping
fetches, warm data paints instantly on mount via IndexedDB then revalidates in
the background, and bookings evict the mutated calendar. `useNow` replaces
FreePage's frozen mount timestamp so a long-open PWA refreshes "now" on tab
focus and every 30 min. B-10 (batch endpoint) deferred — the dedupe already
removes most duplicate traffic and multipart parsing wasn't worth the risk.

## 2026-07-18 — Executable schema for structured docs

BACKLOG.md and JOURNAL.md formats are now enforced by a vitest suite
(tests/docsSchema.test.ts) that validates IDs, priority/effort values, plan
links against real files, status markers, and journal entry headings/order.
Since `npm test` runs on every change, doc drift now fails the same gate as
code regressions.

## 2026-07-17 — Lifecycle skill suite + this journal

Added the **backlog** skill (idea capture, triage, grooming, status
conventions) and the **ship** skill (plan → implement → verify → doc
close-out → commit), completing the development-lifecycle coverage so
sessions can be driven purely by ideas and "do B-nn". Started this journal
as part of ship's close-out step.

## 2026-07-06 — Process foundation
Refs: B-01…B-23, plans 1–13

Full codebase review produced the backlog (14 improvement items) and a
vision-track brainstorm added 9 more, each grouped into plan docs.
Restructured CLAUDE.md, wrote ARCHITECTURE.md, and added the **verify** and
**visual-check** project skills. The concierge plan (B-23) was repointed
from a cloud API to a local model.

## 2026-06-25 — Desktop-first layout overhaul

A week of layout work (June 24–25) made desktop the primary experience:
day-detail left rail + metrics right rail, auto-hiding top nav, wheel-paged
months with the whole month always visible, and depth styling (shadows on
availability fills and top-pick stars). Desktop became the default
media-query branch; mobile was left frozen.

## 2026-06-17 — Initial build burst

The recorded history starts here (June 16–17): rapid iteration on the Free
page (metrics placement, day cards, relationship controls scoped to the
displayed month), the Scheduler taking shape as the calendar-plus-metrics
main view, and Settings gaining graphical controls for every CSS design
token with curated font stacks.
