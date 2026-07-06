# Plan 13 — Concierge: natural language over the engine

**Backlog items:** B-23
**Track:** vision — do last

## Vision

A natural-language front door: "when can we do dinner with my parents? they
can't do Fridays" → the model translates intent into calls against the
deterministic availability engine and drafts the coordination message. The
engine stays pure and testable; the LLM is only the interface. No backend —
the Claude API is called directly from the browser with a user-supplied key,
stored locally exactly like the OAuth client ID.

## Approach

1. **Key & plumbing**: `anthropicApiKey` in settings (Account panel, password
   field, never exported by Plan 4). New `src/api/claude.ts` — direct
   `fetch` to the Messages API with the CORS header
   (`anthropic-dangerous-direct-browser-access: true`), defaulting to the
   current Sonnet model for latency/cost. **Consult the `claude-api` skill
   during implementation** for current model ids and tool-use format.
2. **Tools, not context-stuffing**: expose the engine as tool definitions the
   model can call, rather than dumping the calendar into the prompt:
   - `find_free_slots(range, windows, constraints)` — wraps `findFreeSlots` +
     ranking; constraints like "not Fridays" filter the results.
   - `find_mutual_slots(...)` — relationship overlap (Plan 5's hooks).
   - `find_trip_windows(length, range)` — Plan 8.
   - `what_if(event)` — Plan 12's structured diff.
   - `compose_share_message(slots)` — Plan 9 / B-18.
   A small client-side tool-use loop (`src/lib/concierge.ts`) executes calls
   against already-fetched data and returns results as JSON. Free-window data
   goes to the API only as tool *results* (windows, not event titles) unless
   the user's question requires event context — state this in the UI.
3. **No write tools.** The concierge can propose ("book it?") but booking goes
   through the existing explicit UI actions. Keeps the POST-only guarantee
   human-gated.
4. **Surface**: a chat-lite panel — command-palette style input on the Free
   view (desktop-first: `Cmd/Ctrl+K`), answers rendered as the app's own
   components (slot lists, run cards, share basket) with the model's prose as
   connective text. Not a general chatbot: a query box that answers scheduling
   questions and hands results to existing UI.
5. **Graceful absence**: no API key → the input hides behind a one-line
   Settings pointer. Everything else in the app works without it.

## Files

- New: `src/api/claude.ts`, `src/lib/concierge.ts` (tool definitions + loop),
  `src/components/ConciergePanel.tsx`
- Touch: `src/store/settings.ts`, `src/pages/settings/AccountPanel.tsx`,
  `src/pages/FreePage.tsx` or `src/App.tsx` (palette mount)
- Tests: `tests/concierge.test.ts` — tool loop with a **stubbed** model client
  (scripted tool-call sequences); tool handlers unit-tested against mock data.
  No live API calls in tests.

## Testing

- Unit: each tool handler returns correct JSON for fixture queries; the loop
  handles multi-step tool use, tool errors, and a model that answers without
  tools.
- Mock render test: panel renders a scripted conversation's slot results via
  the real components.
- Manual: a handful of live golden prompts ("dinner with parents, no Fridays",
  "3-day getaway in September", "can I take a Thursday 6pm call?").

## Risks / notes

- **Hard prerequisites**: Plans 5 (hooks), 9/B-18 (composer); Plans 8 and 12
  determine how useful it is — with only `find_free_slots` it's a thin wrapper.
  This plan is deliberately last: it's leverage on everything before it.
- Browser-direct API keys are user-owned cost; keep a per-question token cap
  and show usage.
- Scope creep is the main product risk: it answers scheduling questions only —
  refuse general chat in the system prompt to keep expectations tight.
