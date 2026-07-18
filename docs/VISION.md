# Product vision — free time as the object

Distilled from a first-principles design review (2026-07-18) of the vision
track (plans 7–13). This is the product's north star; [Plan 14](plans/plan-14-shell.md)
is the structural work that aligns the UI with it.

## The mental model

A calendar app's unit of thought is the **event** — a thing you have. This
app's unit is the **opening** — a thing you could lose. Free time is a scarce,
depletable asset the calendar is constantly eating; the app is its steward,
not a scheduler. The user's sequence on open:

1. **"How are we doing?"** — floors intact (budgets), rituals on rhythm,
   time draining faster than usual. Ambient, glanceable, zero clicks.
2. **"When can we…?"** — a specific intent: a slot, a mutual evening, a
   3-day getaway. A query, not a browse.
3. **"What do I do about it?"** — protect a slot, book the ritual, send
   "times that work" to someone outside the app, or price an incoming invite.

"What's on my schedule today?" is deliberately absent — Google Calendar
answers that. This app owns the calendar's negative space, in the couple's
first-person plural. Emotional register: **calm advisor** — warnings degrade
to silence, overdue is a soft nudge, never a streak or a score.

## The spaces

- **State** — the map of free time ahead with the defense layer on it
  (budgets, rituals, countdowns, velocity). Plans 7, 10, 11.
- **Ask** — query mode: slots, mutual slots, getaway runs, eventually
  natural language over all of it (plans 8, 13). The concierge is the mature
  form of this mode, not a separate feature.
- **Decision** — price an incoming demand (what-if, plan 12), then decline,
  accept, or counter with a protective hold (plan 7).
- **Handoff** — move the answer out to people who don't use the app
  (composer, exchange — plan 9). The app's real job ends outside the app.

Settings is maintenance, not a mode; visited rarely.

## The paradigm

**One persistent canvas — the calendar of free time — with a defense rail
beside it and a query layer above it. Modes are lenses on the canvas, not
destinations.** Every vision feature projects onto the same object: trip runs
as spans, what-if as ghosts, ritual suggestions as jumps, share baskets
assembled from days, budget deficits pointing at defensible days, concierge
answers rendered as the app's own components. Tab-per-feature would shatter
one continuous object into rooms.

Desktop landscape is the honest primary target (persistent rail, overlay-dense
canvas, Cmd+K). The phone's role is the Handoff moment — a purpose-built
share/answer surface, not a shrunken canvas.

## Anti-features

The discipline: **never compete with Google Calendar; interpret it.**

- No event management: no viewing/editing/rescheduling/deleting; busy time is
  undifferentiated shading. (POST-only writes are the product boundary, not
  just a safety rule.)
- No hour-grid week view; the grains are the window and the day.
- No "Add event" as a primary action — the only writes are protective
  (holds, ritual bookings, dates).
- No server-mediated coordination: no booking links, hosted polls, invitee
  flows. Sharing is a pasteable artifact.
- No push notifications or nagging; the app warns when looked at.
- No gamification: no streaks, scores, badges.
- No analytics theater: one sparkline and one sentence beat a charts tab.
- No general-purpose chat; the concierge answers scheduling questions only.

## Where the current UI stands (2026-07-18 review)

The desktop `xl` FreePage layout is ~70% of the paradigm already: canvas +
left action rail + right rail, with a genuinely extensible `OverlayLayer`
system and the drag-to-book window as the model slot action. The structural
gaps, owned by [Plan 14](plans/plan-14-shell.md):

- **Replace** — the Free/Check tab split (Check becomes a query layer over
  the canvas, B-24); the "Already booked" event list (event-management
  creep); the frozen mobile layouts (long-term: a handoff surface instead).
- **Reconsider** — the auto-hiding hover nav (B-27); StatCards conflating
  status/toggle/color-picker (B-25 splits them: toggles → canvas legend,
  rail → defense column); scoreboard framing of counts; the zero-free and
  idle-rail dead ends (B-26).
- **Extend** — FreeCalendar + OverlayLayer (add ghost/span styles); the day
  card as per-day action console (Hold, what-if, share reuse the Plan-date
  drag pattern); the human-phrasing vocabulary (feeds the composer);
  cadence generalized per plan 10.
- **Cosmetic** — naming ("Scheduler" tab, "Am I free?" headline vs "when are
  *we* free?"), emoji iconography, the loud ★ overlay.
