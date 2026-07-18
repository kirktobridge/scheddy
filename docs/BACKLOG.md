# Backlog

Change opportunities identified from a full codebase review (2026-07-06),
extended by the UI design review of 2026-07-18 (B-24…B-27; see
[docs/VISION.md](VISION.md)). Each item has an ID referenced by the plan
documents in [docs/plans/](plans/).

Priority: **P1** = highest user impact, **P2** = valuable, **P3** = polish.
Effort: **S** < half a day, **M** = a day-ish, **L** = multi-day.

| ID | Title | Priority | Effort | Plan | Status |
|----|-------|----------|--------|------|--------|
| B-01 | Event data cache with stale-while-revalidate + IndexedDB persistence | P1 | L | [Plan 1](plans/plan-1-data-layer.md) | ✅ 2026-07-18 |
| B-02 | Refresh "now" + data on visibility regain (stale `nowMs` fix) | P1 | S | [Plan 1](plans/plan-1-data-layer.md) | ✅ 2026-07-18 |
| B-03 | URL state: hash routing for tabs + deep-linkable Check ranges | P2 | M | [Plan 3](plans/plan-3-navigation.md) | |
| B-04 | Settings export/import (portability across devices) | P2 | M | [Plan 4](plans/plan-4-settings-portability.md) | |
| B-05 | App-level error boundary with recovery | P1 | S | [Plan 2](plans/plan-2-resilience-auth.md) | ✅ 2026-07-18 |
| B-06 | "Both of us" mutual availability in range queries ("are *we* free?") | P2 | M | [Plan 5](plans/plan-5-feature-extensions.md) | |
| B-07 | Quick-block: hold any free slot as an event from the Free view | P2 | M | [Plan 5](plans/plan-5-feature-extensions.md) | |
| B-08 | Auth expiry UX: "sign in again" banner instead of surprise Google popup | P1 | M | [Plan 2](plans/plan-2-resilience-auth.md) | |
| B-09 | Extract relationship/busy computation out of FreePage into hooks | P2 | M | [Plan 5](plans/plan-5-feature-extensions.md) | |
| B-10 | Batch Google Calendar fetches (one HTTP round trip) | P3 | M | [Plan 1](plans/plan-1-data-layer.md) | ✂️ deferred 2026-07-18 |
| B-11 | Loading skeleton for the calendar instead of full-page spinner | P3 | S | [Plan 6](plans/plan-6-ux-polish.md) | |
| B-12 | First-run onboarding state (welcome card, not an error banner) | P2 | S | [Plan 6](plans/plan-6-ux-polish.md) | |
| B-13 | Keyboard navigation on the calendar grid (arrow keys, Enter) | P3 | M | [Plan 3](plans/plan-3-navigation.md) | |
| B-14 | Visible "demo data" badge in mock mode | P3 | S | [Plan 6](plans/plan-6-ux-polish.md) | |
| B-24 | Unified canvas: dissolve Check into a query layer over the calendar | P1 | L | [Plan 14](plans/plan-14-shell.md) | |
| B-25 | Defense rail: status+action rows; layer toggles move to a canvas legend | P2 | L | [Plan 14](plans/plan-14-shell.md) | |
| B-26 | Canvas persistence: calendar always renders; idle rail shows next actions | P2 | M | [Plan 14](plans/plan-14-shell.md) | |
| B-27 | Retire tab nav: corner controls + naming/register pass | P3 | S | [Plan 14](plans/plan-14-shell.md) | |

## Vision track

Product-vision directions (2026-07-06 brainstorm) — new capabilities rather than
fixes. Same ID space, plans 7–13. Effort here is coarser; most are L.

| ID | Title | Priority | Effort | Plan |
|----|-------|----------|--------|------|
| B-15 | Time budgets: declare free-time floors, app defends them | P2 | L | [Plan 7](plans/plan-7-time-defense.md) |
| B-16 | Booking velocity: daily snapshots + "filling up fast" warnings | P2 | M | [Plan 7](plans/plan-7-time-defense.md) |
| B-17 | Trip finder: multi-day mutual-free gap search | P2 | L | [Plan 8](plans/plan-8-trip-finder.md) |
| B-18 | "Times that work" composer: one-tap shareable availability message | P1 | M | [Plan 9](plans/plan-9-share-times.md) |
| B-19 | Availability exchange: import a friend's exported free windows, compute overlap locally | P3 | L | [Plan 9](plans/plan-9-share-times.md) |
| B-20 | Rituals: per-rule cadence targets with suggested next slot | P2 | L | [Plan 10](plans/plan-10-rituals.md) |
| B-21 | Metric history: persist monthly metrics, trends + scarcity countdowns | P2 | M | [Plan 11](plans/plan-11-history-trends.md) |
| B-22 | What-if: preview a tentative event's impact on the week/month | P2 | M | [Plan 12](plans/plan-12-what-if.md) |
| B-23 | Concierge: natural-language queries + drafted coordination messages | P3 | L | [Plan 13](plans/plan-13-concierge.md) |

Vision-track dependencies:

- B-16 and B-21 share one **snapshot store** (build once, in whichever lands first).
- B-23 builds on B-17/B-18/B-22 as its callable "tools"; do it last.
- B-18 is the standout quick win — the only P1 in the track.
- The *surfaces* of plans 7, 8, 10, 11 and 13 assume Plan 14's canvas/rail
  shell (B-24/B-25); their engines are independent and can start any time.

## Grouping rationale

- **Plan 1 — Data layer** (B-01, B-02, B-10): all touch how events are fetched
  and kept fresh; share the `useEvents` / `api/calendar.ts` seam.
- **Plan 2 — Resilience & auth** (B-05, B-08): failure-path UX; both change what
  the user sees when something goes wrong.
- **Plan 3 — Navigation** (B-03, B-13): how the user moves around the app, by
  URL and by keyboard.
- **Plan 4 — Settings portability** (B-04): standalone; only touches settings
  store + Settings page.
- **Plan 5 — Feature extensions** (B-06, B-07, B-09): new capabilities that
  need the FreePage extraction (B-09) as a prerequisite.
- **Plan 6 — UX polish** (B-11, B-12, B-14): small independent visual wins.
- **Plan 14 — Shell** (B-24…B-27): the 2026-07-18 design review's structural
  work — one canvas + query layer + defense rail, the surface the vision
  track lands on. Direction in [docs/VISION.md](VISION.md).

## Suggested order

1. Plan 2 (small, protects everything else)
2. Plan 5 / B-09 extraction (hard prerequisite for the shell and plan 12)
3. Plan 14 in item order B-24 → B-25 → B-26 → B-27 (establishes the surface
   everything after lands on)
4. Plan 5 Stages 2–3 and B-18 (the vision track's quick win) on the new shell
5. Plan 3 (URL scheme reshaped by B-24), Plan 4, Plan 6 in any order
6. Remaining vision plans (7, 8, 10, 11, 12), then Plan 13 last.
