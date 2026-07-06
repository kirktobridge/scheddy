# Plan 4 — Settings portability

**Backlog items:** B-04 (export/import, optional Drive sync)

## Problem

All ~40 settings fields live only in `localStorage`
([src/store/settings.ts:144](../../src/store/settings.ts#L144)). A new phone, a
new browser, or cleared site data means reconfiguring calendars, windows,
metric rules, relationship setup, and design tokens from scratch. The README's
"no backend" ethos is a feature — portability should stay client-side.

## Approach

### Core: export / import JSON

1. Add `settingsVersion: number` to `Settings` (start at `1`) and a
   `migrate(parsed)` step in `loadSettings` — the existing legacy `colors →
   tokens` fold becomes migration #1. Import runs through the same migration.
2. New functions in `src/store/settings.ts`:
   - `exportSettings(): string` — current settings as pretty JSON, **excluding**
     `clientId` only if baked via env (keep it when user-entered; it's the one
     field needed to bootstrap a new device). Never include `scheddy.token`.
   - `importSettings(json: string): { ok: true } | { ok: false, error }` —
     parse, validate shape (spot-check a few required keys and types), run
     migrations, merge over `DEFAULT_SETTINGS`, persist, notify listeners.
3. UI in [src/pages/settings/AccountPanel.tsx](../../src/pages/settings/AccountPanel.tsx):
   - **Export** — downloads `scheddy-settings.json` (Blob + anchor click) and a
     "copy to clipboard" alternative for phones.
   - **Import** — `<input type="file">` + paste-area fallback; confirm dialog
     ("replaces current settings") before applying; success/error inline note.

### Stretch: Google Drive `appDataFolder` sync

- Extra scope `https://www.googleapis.com/auth/drive.appdata` (additive consent
  prompt). Store one `settings.json` in the hidden app-data folder; "Save to
  Drive" / "Load from Drive" buttons — explicit, not automatic, to avoid
  cross-device clobber logic. Skip entirely if the consent-screen change is
  annoying; the file export already solves the core problem.

## Files

- `src/store/settings.ts`, `src/pages/settings/AccountPanel.tsx`
- Stretch: `src/api/driveSync.ts` (new), `src/auth/google.ts` (scope)
- `tests/settingsPortability.test.ts` (new)

## Testing

- Unit: export → import round-trip is identity; import of legacy `colors`
  payload migrates; malformed JSON / wrong shape rejected with error, settings
  untouched.
- Mock render test: AccountPanel shows both controls; import updates a visible
  setting.
- Manual: export on desktop, import in a private window, verify calendars and
  rules restored (token/sign-in still required, as expected).

## Risks / notes

- Imported calendar IDs may not exist on another Google account — harmless
  (fetch just returns errors for unknown calendars); note it in the import
  confirm text.
- Keep validation lenient: unknown keys dropped, missing keys defaulted —
  forward-compatible with future settings.
