# Plan 14 — Shell: unified canvas, query layer, defense rail

**Backlog items:** B-24 (dissolve Check into a query layer), B-25 (defense
rail), B-26 (canvas persistence), B-27 (retire tab nav)
**Track:** vision — structural prerequisite for the surfaces of plans 7–11 and 13

## Vision

From the 2026-07-18 design review ([docs/VISION.md](../VISION.md)): every
vision feature is a lens over one object — the calendar of free time — so the
app's shape should be a single persistent canvas with a left action rail, a
right defense rail, and a query layer on top. Three things fight that shape
today: the Free/Check tab split (queries navigate away from the canvas), the
right rail's StatCards (one card doing status + layer-toggle + color-picker),
and the auto-hiding hover nav (a workaround for tabs the app doesn't want).

## Approach — items land in order, each shippable

### B-24: dissolve Check into a query layer (L)

- CheckPage's controls (preset chips, month select, custom range, window
  filter) move into a mode bar in the canvas header — `FreeCalendar`'s
  existing `headerSlot` is the mount point. Idle state = today's behavior.
- An active query filters and highlights the canvas (range outside the query
  dims; matching free windows highlight) and renders its slot list in the
  left rail, where the day card lives. Escape/"clear" returns to idle.
- A "Both of us" chip joins the mode bar when relationship mode is on —
  absorbing B-06's *surface*; its engine work (partner streams → mutual
  slots) stays as Plan 5 Stage 2.
- The "Already booked" `EventList` pane is dropped, not ported (see
  VISION.md anti-features): range busyness reads off the canvas density,
  plus a one-line summary ("4 of 6 evenings already taken").
- `CheckPage.tsx` and the Check tab are deleted at the end of this item.

**Shipped 2026-07-20.** New `useQueryMode` hook holds the lens state (preset /
month / custom range + window filter + "Both of us"); `QueryModeBar` mounts in
`FreeCalendar`'s `headerSlot` (desktop only), `QueryResults` renders the slot
list in the left rail. Active query dims the canvas outside its range
(`queryRange` prop on `FreeCalendar`) and rings matching days (a `query`
`OverlayLayer`); a one-line summary reads range busyness defensively ("3 of 6
days already booked"). Escape/Clear → idle. `CheckPage.tsx`, `EventList.tsx`,
and the Check tab are deleted.

Deviations from plan:
- **Query bounded by the canvas horizon.** Rather than fetching its own
  arbitrary range like CheckPage, the query filters the already-loaded canvas
  span (clamped to `[today, maxDate]`); the month select only offers months
  within that span. One fetch, no separate range pipeline. Ranges past the
  horizon aren't reachable — acceptable while the horizon is 45–90 days, and it
  keeps the "lens over the canvas" model honest. (Revisit if far-out month
  queries are wanted.)
- **"Both of us" wired to existing `relationship.overlapBusy`** (mutual busy
  already computed by `useRelationshipOverlays`) instead of shipping a dead
  chip. The fuller partner-stream → mutual-slot engine work still belongs to
  Plan 5 Stage 2.
- **Nav pointer-events fix (small B-27 down-payment).** The hidden auto-hiding
  desktop nav's in-flow height intercepted clicks on the mode bar; made its
  container `pointer-events-none` with the nav + cue re-enabling events. B-27
  removes the nav wholesale.

### B-25: defense rail (L)

- Split StatCard's three jobs:
  - **Layer toggles** (metric highlights, overlap subsets, week picks) move
    to a compact "Layers" legend attached to the canvas — they configure the
    view, not report status.
  - **Color pickers** move to Settings → Appearance next to the other tokens.
  - The **right rail** becomes the defense column: status rows in words with
    per-row actions. Counts reframe defensively ("3 free weekend days left
    in July"); the date cadence nudge becomes a first-class rhythm line
    ("last: 9 days ago · due in 5") instead of a tooltip + footer badge.
- This is the surface plans 7 (budget status), 10 (ritual rhythm lines) and
  11 (countdowns, sparklines) land on — build the row pattern here, once.

**Shipped 2026-07-20.** The right rail split into two new components in a `w-72`
aside — `DefenseRail` on top (more eye-catching), `LayersLegend` below.
`LayersLegend` is the quiet control panel: a compact toggle list (picks, week
picks, evenings, weekend, keyword rules, and the relationship overlays with their
subsets) driving the same overlay state the stat cards used to. `DefenseRail`
is the glanceable hero: **number-led stat cards** (`DefenseRow` + `DefenseAction`
+ `DefenseMeter`, the pattern plans 7/10/11 reuse) — a big bold numeral, a
defensive label + scope line ("free weekend days" / "left in July"), a
layer-color left accent bar tying the card to its map overlay, an ambient meter
(free ÷ total-in-month, or progress-to-due), and a contextual verb. The date
cadence is a first-class card leading with urgency ("3 · days overdue for a
date · last 2 weeks ago") and a **Plan** verb that jumps to the next date-option
day. Per-metric highlight colors moved to Settings → Appearance ("Metric
highlight colors" section, reusing `TokenField`); the `StatCard` 🎨 picker and
`MetricsStats.onColor` are deleted.

The number-led card treatment + meters + defense-above-legend order came from a
post-build design pass with the user (the first cut used flat text rows, which
lost the old tiles' at-a-glance magnitude).

Design decisions confirmed with the user before building (both AskUserQuestion):
the layers legend lives **in the right rail above the defense rows** (not a
canvas-attached legend), and defense rows carry a **contextual verb button**
(Show/Hide to surface a layer, Plan to act) rather than being toggles themselves.

Deviations from plan:
- **Legend stayed in the right rail**, not "attached to the canvas" — same
  column as the defense rows, per the user's choice. Keeps the canvas header to
  the query mode bar (B-24) alone.
- **Evenings + weekend appear in both the legend (as toggles) and the defense
  rail (as defensive status)** — intended dual role (configure vs. report), so
  the mock-test "page loaded" sentinel moved off `/unbooked evenings/` (now
  double-matched) to `/Top picks/`.
- **Mobile (frozen) keeps the old `MetricsStats`/`RelationshipStats` cards**,
  now without the inline color dots; only the desktop rail was rebuilt. The
  single-use `relCards('mobile')` collapsed to a `relCardsMobile` element.

### B-26: canvas persistence (M)

- `days.length === 0` no longer blanks the page: the calendar always
  renders; zero free days becomes a red-alert row in the defense rail — the
  moment the map matters most.
- The left rail's idle state ("Pick a day to see its free time") becomes a
  next-actions summary: top picks as actionable rows, the overdue ritual,
  the budget in deficit. Also the landing place for B-24's query results.
- Complements B-11 (skeleton covers cold load; this covers everything else).

**Shipped 2026-07-20.** `days.length === 0` no longer bails the desktop page: the
render gate became `isDesktop || days.length > 0`, so the canvas (`FreeCalendar`)
always mounts. Zero-free is reframed as a red-alert `DefenseRow` (`no-free`, value
0, warn meter, "nothing open in the next N days") prepended to the defense rail —
the moment the map matters most. The idle left rail's placeholder became a new
`NextActions` component: the soonest ≤4 top picks (from `days`) as one-tap rows
(★ + relative label + free hours) that select the day, plus the overdue-date
nudge promoted to a "Plan →" ritual row that jumps to the next date-option day.
It still yields to the day card on selection and to `QueryResults` on an active
query. A `freeHours(slots)` helper was extracted to `lib/availability` (shared
with `FreeCalendar`'s hover preview).

Deviations from plan:
- **Budget-in-deficit row omitted** — the time-budget engine (B-15, Plan 7) isn't
  built yet, so the idle rail surfaces only what exists (picks + overdue ritual).
  It's the landing surface budgets extend later, as planned.
- **Mobile (frozen) keeps the terse "Busy life!" zero-free fallback** — the
  always-render behavior is desktop-only (`!isDesktop && days.length === 0` still
  shows the old message); only the desktop canvas + defense alert are new.

### B-27: retire tab nav (S)

- With Check gone, tabs are just the canvas + Settings. Delete the
  auto-hiding hover nav and bottom tab bar; replace with quiet corner
  controls (settings gear, refresh/staleness indicator).
- Naming/register pass rides along: drop the "Scheduler" label, headline in
  the plural voice, tame the text-5xl ★ pick overlay.

## Files

- Touch heavily: `src/App.tsx`, `src/pages/FreePage.tsx`,
  `src/components/FreeCalendar.tsx` (mode bar in `headerSlot`, legend),
  `src/components/MetricsStats.tsx`, `src/components/RelationshipStats.tsx`,
  `src/components/StatCard.tsx` (b-25 rework), `src/pages/settings/AppearancePanel.tsx`
- Delete: `src/pages/CheckPage.tsx` (B-24), nav machinery in `App.tsx` (B-27)
- New: query-layer state hook (e.g. `src/hooks/useQueryMode.ts`), defense-rail
  row components
- Tests: query-layer mock tests replace `tests/*check*` coverage;
  `tests/freeRegression.mock.test.tsx` is the safety net throughout

## Testing

- Mock harness: mode chip activates → canvas highlights + left-rail slot list
  matches the old CheckPage results for the same fixtures; clearing restores.
- Rail rework: toggles in the legend still drive layers; status rows render
  the defensive phrasing; cadence rhythm line shows overdue state.
- B-26: zero-free fixture still renders the calendar and shows the alert row.
- Visual-check pass per CLAUDE.md after each item.

## Risks / notes

- **Hard prerequisite: Plan 5 Stage 1 (B-09)** — don't build the query layer
  against FreePage's inline memo chain.
- Reshapes Plan 3's URL scheme: one canvas route with query params
  (`#/?preset=weekend`) instead of `#/check?…`; `#/settings` stays.
- B-24 is the risk concentrator (deletes a page); keep the old CheckPage
  until its mock tests are reproduced against the query layer.
- B-27 only makes sense after B-24; B-25 and B-26 are independent of each
  other but both want B-24's left-rail conventions — order as listed.
- Vision plans 7, 8, 10, 11, 13 should land *after* their target surface
  exists here; their engines don't wait on anything.
