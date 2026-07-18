# scheddy

Personal PWA answering "when am I free / when are we free?" from Google
Calendars, plus monthly life metrics (date nights, unbooked evenings). No
backend: OAuth token + settings live in localStorage. React 19 + Vite +
Tailwind v4 + date-fns; tests via Vitest.

Architecture, data flow, and invariants: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Product direction (mental model, UI paradigm, anti-features): [docs/VISION.md](docs/VISION.md).
Roadmap: [docs/BACKLOG.md](docs/BACKLOG.md) (items B-01…B-27) with per-group
plans in [docs/plans/](docs/plans/).

## Node on WSL
Plain `npm` hits a Windows binary. Prefix PATH first:
`export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"`

## Commands

```bash
npm run dev        # http://localhost:5173
npm test           # vitest run (full suite, ~5s)
npm run typecheck  # tsc --noEmit
npm run build      # production build in dist/
npm run icons      # regenerate PWA icons (committed in public/)
```

## Mock mode
The app needs Google calendars picked in Settings to show data. For dev/visual
checks, force the bundled mock dataset with the `?mock=1` URL param
(`?mock=0` disables). Honored in [src/main.tsx](src/main.tsx) before first render;
mock data/impl in [src/api/mock.ts](src/api/mock.ts).

## Testing conventions
- Default vitest environment is **node** (TZ pinned to America/New_York in
  [vite.config.ts](vite.config.ts)). DOM tests must start with the
  `// @vitest-environment jsdom` pragma or they fail confusingly.
- Pure-logic tests: `tests/<module>.test.ts` against `src/lib/*` — prefer
  these; the lib layer is pure functions and cheap to cover.
- Mock-mode DOM tests: `tests/*.mock.test.tsx` using the `renderMock` harness
  ([tests/helpers/mockApp.tsx](tests/helpers/mockApp.tsx)) — renders real
  components against the `?mock=1` fixtures, no network/auth.
- Self-validate UI work with these tests; don't ask for manual checks when a
  jsdom assertion can prove it.

## Visual verification
To eyeball a UI change in a real browser, use the **visual-check** project
skill ([.claude/skills/visual-check/SKILL.md](.claude/skills/visual-check/SKILL.md))
— dev server + Playwright screenshot against `?mock=1`.

Layout breakpoints: `lg` (1024px) = sidebar becomes left nav; `xl` (1280px) =
single-month calendar + right-side metrics panel. Below `xl` = multi-month grid +
mobile bottom sheet. Page content spans full width, left-aligned ([src/App.tsx](src/App.tsx)).

## Platform scope (desktop-first)
**Desktop landscape is the primary, supported experience; min supported width is
`xl` (1280px).** Mobile/narrow layouts (multi-month grid + `BottomSheet` below
`xl`) are **deprecated and frozen** — kept working but not invested in. Don't add
mobile-specific features or treat narrow-viewport quirks as bugs. The mobile
branches live mostly in [src/pages/FreePage.tsx](src/pages/FreePage.tsx) behind
`isDesktop` gates; remove them only when one actively blocks a desktop change, one
piece at a time. Because the paths are interwoven, prefer deprecation over a big
teardown.

Tests reflect this: [src/hooks/useMediaQuery.ts](src/hooks/useMediaQuery.ts)
defaults to `true` (desktop) under jsdom, so mock tests exercise the shipped
desktop layout by default. Mobile-specific tests opt in by mocking `matchMedia`
to `false`.

## Workflow
- Run `npm test` after every change; `npm run typecheck` before committing.
- Commit straight to `main` (no feature branches); commit after each major
  change. Conventional-commit subjects (`feat:`, `fix:`, `docs:`, `style:`,
  `refactor:`, scope optional), ≤ 50 chars.
- After any major change lands, append an entry to
  [docs/JOURNAL.md](docs/JOURNAL.md) (format documented there). The **ship**
  skill does this in its close-out; ad-hoc work must too.
- **Safety invariant:** the write path is POST-only — `createEvent` is the only
  mutating API call. Never add update/delete calls or widen the OAuth scope
  (see [src/api/calendar.ts](src/api/calendar.ts), [src/auth/google.ts](src/auth/google.ts)).
