---
name: verify
description: Verify a scheddy change end-to-end before committing — tests, typecheck, and (for UI work) driving the real app in mock mode. Use before any commit of nontrivial changes.
---

# Verifying a change in scheddy

Ordered checklist; stop and fix at the first failure. Always with the WSL
node PATH (`export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"`).

## 1. Full test suite (always)

```bash
npm test
```

~5s, no watch mode. If you changed engine logic (`src/lib/*`) without a test
breaking, that's a coverage gap — add a case to the matching
`tests/<module>.test.ts` that would have caught a regression.

## 2. Typecheck (always, before commit)

```bash
npm run typecheck
```

Vitest doesn't typecheck; green tests can hide type errors.

## 3. Behavior check (match to the change)

- **Engine/lib change** — unit tests in step 1 are the verification, but make
  sure at least one asserts the *new* behavior, not just old behavior
  surviving.
- **UI change (DOM structure/behavior)** — add or extend a
  `tests/*.mock.test.tsx` using `renderMock`
  ([tests/helpers/mockApp.tsx](../../../tests/helpers/mockApp.tsx)); remember
  the `// @vitest-environment jsdom` pragma. This is the repo's standard
  self-validation path — prefer it over asking for a manual check.
- **UI change (visual: layout, spacing, color, theming)** — jsdom can't see
  it; run the **visual-check** skill (screenshot at 1600×1000, and 1280×800 if
  layout-sensitive; both themes if colors changed).
- **API/auth/settings-shape change** — exercise the real flow in a browser via
  `?mock=1` (visual-check skill with interactions), and for settings-shape
  changes confirm an old localStorage blob still loads (see `loadSettings`
  fixups in [src/store/settings.ts](../../../src/store/settings.ts)).

## 4. Safety invariant (any change touching src/api or src/auth)

Confirm the write path is still POST-only (`createEvent` is the sole mutation)
and OAuth scopes are unchanged (`calendar.readonly` + `calendar.events`).
Anything wider is a design regression — flag it, don't ship it.

## 5. Commit

Straight to `main`, conventional-commit subject ≤ 50 chars. Rerun steps 1–2 if
anything changed since they last ran.
