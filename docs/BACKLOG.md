# Backlog

Change opportunities identified from a full codebase review (2026-07-06). Each item
has an ID referenced by the plan documents in [docs/plans/](plans/).

Priority: **P1** = highest user impact, **P2** = valuable, **P3** = polish.
Effort: **S** < half a day, **M** = a day-ish, **L** = multi-day.

| ID | Title | Priority | Effort | Plan |
|----|-------|----------|--------|------|
| B-01 | Event data cache with stale-while-revalidate + IndexedDB persistence | P1 | L | [Plan 1](plans/plan-1-data-layer.md) |
| B-02 | Refresh "now" + data on visibility regain (stale `nowMs` fix) | P1 | S | [Plan 1](plans/plan-1-data-layer.md) |
| B-03 | URL state: hash routing for tabs + deep-linkable Check ranges | P2 | M | [Plan 3](plans/plan-3-navigation.md) |
| B-04 | Settings export/import (portability across devices) | P2 | M | [Plan 4](plans/plan-4-settings-portability.md) |
| B-05 | App-level error boundary with recovery | P1 | S | [Plan 2](plans/plan-2-resilience-auth.md) |
| B-06 | Relationship mode on Check page ("are *we* free?") | P2 | M | [Plan 5](plans/plan-5-feature-extensions.md) |
| B-07 | Quick-block: hold any free slot as an event from the Free view | P2 | M | [Plan 5](plans/plan-5-feature-extensions.md) |
| B-08 | Auth expiry UX: "sign in again" banner instead of surprise Google popup | P1 | M | [Plan 2](plans/plan-2-resilience-auth.md) |
| B-09 | Extract relationship/busy computation out of FreePage into hooks | P2 | M | [Plan 5](plans/plan-5-feature-extensions.md) |
| B-10 | Batch Google Calendar fetches (one HTTP round trip) | P3 | M | [Plan 1](plans/plan-1-data-layer.md) |
| B-11 | Loading skeleton for the calendar instead of full-page spinner | P3 | S | [Plan 6](plans/plan-6-ux-polish.md) |
| B-12 | First-run onboarding state (welcome card, not an error banner) | P2 | S | [Plan 6](plans/plan-6-ux-polish.md) |
| B-13 | Keyboard navigation on the calendar grid (arrow keys, Enter) | P3 | M | [Plan 3](plans/plan-3-navigation.md) |
| B-14 | Visible "demo data" badge in mock mode | P3 | S | [Plan 6](plans/plan-6-ux-polish.md) |

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
| B-23 | Concierge: natural-language queries + drafted coordination messages (Claude API) | P3 | L | [Plan 13](plans/plan-13-concierge.md) |

Vision-track dependencies:

- B-16 and B-21 share one **snapshot store** (build once, in whichever lands first).
- B-23 builds on B-17/B-18/B-22 as its callable "tools"; do it last.
- B-18 is the standout quick win — the only P1 in the track.

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

## Suggested order

1. Plan 2 (small, protects everything else)
2. Plan 1 (biggest daily-use impact)
3. Plan 5 (feature depth; do B-09 first within it)
4. Plan 4, Plan 3, Plan 6 in any order.
