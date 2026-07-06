# Plan 13 — Concierge: natural language over the engine

**Backlog items:** B-23
**Track:** vision — do last

## Vision

A natural-language front door: "when can we do dinner with my parents? they
can't do Fridays" → the model translates intent into calls against the
deterministic availability engine and drafts the coordination message. The
engine stays pure and testable; the LLM is only the interface. No backend —
a **local LLM via Ollama** is called from the browser, no key, no cost, no
data leaving the machine.

## Approach

1. **Runtime & plumbing**: `ollamaEndpoint` (default `http://localhost:11434`)
   and `ollamaModel` (dropdown, populated from `/api/tags`) in settings
   (Account panel). New `src/api/ollama.ts` — `fetch` against Ollama's native
   `/api/chat` with `tools` (OpenAI-compatible tool-calling shape; supported
   by `llama3.1`, `qwen2.5`, `mistral-nemo`, etc — model must be tool-capable,
   filter/label the dropdown accordingly). Ollama defaults to blocking
   cross-origin requests from a browser tab; document that the user must set
   `OLLAMA_ORIGINS=*` (or the app's origin) when starting the Ollama server,
   and detect/report the CORS failure clearly in the UI rather than a silent
   fetch error.
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
   never leaves the machine (Ollama runs locally), but still pass only
   windows, not event titles, into tool results unless the user's question
   requires event context — state this in the UI.
3. **No write tools.** The concierge can propose ("book it?") but booking goes
   through the existing explicit UI actions. Keeps the POST-only guarantee
   human-gated.
4. **Surface**: a chat-lite panel — command-palette style input on the Free
   view (desktop-first: `Cmd/Ctrl+K`), answers rendered as the app's own
   components (slot lists, run cards, share basket) with the model's prose as
   connective text. Not a general chatbot: a query box that answers scheduling
   questions and hands results to existing UI.
5. **Graceful absence**: Ollama not reachable, or reachable but no tool-capable
   model pulled → the input hides behind a one-line Settings pointer
   ("run `ollama pull llama3.1`" or similar). Everything else in the app works
   without it.

## Files

- New: `src/api/ollama.ts`, `src/lib/concierge.ts` (tool definitions + loop),
  `src/components/ConciergePanel.tsx`
- Touch: `src/store/settings.ts`, `src/pages/settings/AccountPanel.tsx`,
  `src/pages/FreePage.tsx` or `src/App.tsx` (palette mount)
- Tests: `tests/concierge.test.ts` — tool loop with a **stubbed** model client
  (scripted tool-call sequences); tool handlers unit-tested against mock data.
  No live Ollama calls in tests.

## Testing

- Unit: each tool handler returns correct JSON for fixture queries; the loop
  handles multi-step tool use, tool errors, and a model that answers without
  tools.
- Mock render test: panel renders a scripted conversation's slot results via
  the real components.
- Manual: a handful of live golden prompts against a locally running Ollama
  ("dinner with parents, no Fridays", "3-day getaway in September", "can I
  take a Thursday 6pm call?").

## Risks / notes

- **Hard prerequisites**: Plans 5 (hooks), 9/B-18 (composer); Plans 8 and 12
  determine how useful it is — with only `find_free_slots` it's a thin wrapper.
  This plan is deliberately last: it's leverage on everything before it.
- **Tool-calling quality varies a lot by local model** — smaller/quantized
  models may hallucinate args or ignore tools entirely. Pick a default that's
  reliable enough out of the box, and fail visibly (not silently) when the
  model replies without using a tool it should have.
- User owns the Ollama install, model pulls, and any hardware/latency cost —
  no per-question token cap needed since it's not metered, but show which
  model answered (quantization/size affects trust in results).
- Scope creep is the main product risk: it answers scheduling questions only —
  refuse general chat in the system prompt to keep expectations tight.
