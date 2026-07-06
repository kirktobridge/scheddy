# Plan 9 — Sharing: "times that work" & availability exchange

**Backlog items:** B-18 (message composer), B-19 (availability exchange)
**Track:** vision

## Vision

The app's real job ends outside the app: coordinating with people who don't
use it. Today the user reads slots off the screen and retypes them into a text
message. B-18 closes that loop with a one-tap composed message. B-19 is the
ambitious sequel: two scheddy users (or a friend with an exported file) compute
mutual availability *without any calendar data leaving either browser*.

## Approach

### B-18: message composer

1. **Selection**: lightweight "share mode" on the Free view — a share icon on
   the day card and on top-pick days adds that slot to a share basket (chip row
   above the calendar). Alternatively "share my top N" seeds the basket from
   the existing ranked picks in one tap.
2. **Composition** (`src/lib/shareText.ts`, pure): slots → human phrasing using
   the vocabulary that already exists (`relativeDayLabel`, window names,
   `formatSlotTime`): "We're free Thu evening (6–10), Sat afternoon, or Sun
   after 5." Handles solo vs "we" (relationshipMode), collapses adjacent
   windows, caps at ~4 options with "…or later that week".
3. **Delivery**: copy to clipboard (primary), `navigator.share` when available
   (installed PWA on phone), and an `.ics` download with tentative
   `TRANSPARENT` holds as a power option.
4. Composer templates (greeting/closing) stay out of scope — it's a fragment
   you paste mid-conversation, not an email generator.

### B-19: availability exchange

1. **Export** (`src/lib/availabilityExchange.ts`): free windows only — never
   events — over a chosen span: `{ version, name, horizon, freeWindows:
   [{ date, window, startMin, endMin }] }`, optionally coarsened to whole
   windows for privacy. Output: JSON file download or a compressed URL
   fragment (`#/import?d=…`, base64 of deflated JSON — fragments never hit a
   server even if hosted).
2. **Import**: file/paste/URL-fragment intake (reuse Plan 4's import UI
   patterns), validated, stored under a friend name in settings (small — free
   windows only, with an expiry).
3. **Overlap**: intersect friend windows with own free slots — the couple
   overlap math ([src/lib/relationship.ts](../../src/lib/relationship.ts))
   generalized from busy-intersection to window-intersection. Surface as a
   Check-page participant chip ("Me + Sam") and feed the result into B-18's
   composer ("times that work for all three of us").

## Files

- New: `src/lib/shareText.ts`, `src/lib/availabilityExchange.ts`,
  `src/components/ShareBasket.tsx`
- Touch: `src/pages/FreePage.tsx`, `src/components/DayTimelineCard.tsx`,
  `src/pages/CheckPage.tsx`, `src/store/settings.ts`
- Tests: `tests/shareText.test.ts`, `tests/availabilityExchange.test.ts`,
  `tests/shareBasket.mock.test.tsx`

## Testing

- Unit: phrasing table-tests (single slot, adjacent merge, cap + overflow
  phrase, solo vs "we"); exchange round-trip incl. URL-fragment encode/decode;
  overlap intersection against fixture windows.
- Mock test: basket → composed string matches expected mock-data phrasing.
- Manual: clipboard + `navigator.share` on an installed PWA.

## Risks / notes

- B-18 first — small, standalone, highest value-per-effort in the vision track
  (the only P1). B-19 only makes sense once composing/sharing exists.
- URL-fragment size: a 60-day horizon of window-level granularity deflates to
  well under 2 KB — fine for messaging apps; still offer the file path.
- Exchange trust model: imported data is a *claim* about availability, not
  truth; label overlaps "as of <export date>", honor the expiry.
