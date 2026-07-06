---
name: visual-check
description: Screenshot the running app (mock data) with Playwright to eyeball a UI change. Use for any visual/layout change, theming work, or when asked to "look at" the app.
---

# Visual check: dev server + Playwright screenshot

Renders the real app in headless Chromium against the bundled mock dataset and
captures a screenshot. **The point is to look at the screenshot** — read it
with the Read tool and actually inspect it before declaring a change good.

## Steps

1. **Node PATH first** (WSL — see CLAUDE.md):
   ```bash
   export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
   ```

2. **Dev server** (background, skip if already running — check with
   `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173`):
   ```bash
   npm run dev
   ```

3. **Playwright** is NOT a project dependency — keep it out of package.json.
   Install outside the repo (once per machine; cached after):
   ```bash
   cd /tmp && npm install playwright && npx playwright install chromium
   ```
   If launch fails with "Executable doesn't exist", the browser build is out of
   sync with the playwright version — rerun `npx playwright install chromium`.

4. **Script** (write to the scratchpad dir, run with the PATH above and
   `NODE_PATH=/tmp/node_modules`):
   ```js
   const { chromium } = require('playwright')
   ;(async () => {
     const browser = await chromium.launch()
     const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
     await page.goto('http://localhost:5173/?mock=1')
     await page.waitForTimeout(2500) // mock data + first paint
     // Optional interactions before the shot, e.g.:
     // await page.click('text=Settings')
     await page.screenshot({ path: 'shot.png', fullPage: false })
     await browser.close()
   })()
   ```

5. **Read the screenshot** and check the thing you changed, plus obvious
   collateral (overlaps, clipping, dark-mode contrast).

## Viewports that matter

- `1600×1000` — primary desktop (`xl` layout: left day-card rail, single-month
  calendar, right metrics rail). This is the supported experience.
- `1280×800` — `xl` lower bound; catches squeeze bugs at the minimum width.
- Narrower viewports are the deprecated mobile layout — don't screenshot them
  unless explicitly asked.

## Variations

- Light theme: mock settings default dark; click through Settings →
  Appearance, or seed via
  `page.addInitScript(() => localStorage.setItem('scheddy.settings', JSON.stringify({ theme: 'light' })))`
  **before** `goto` (merges over defaults on load).
- Real data (`?mock=0`) needs Google auth — not scriptable; use mock mode.
- Day panel: `await page.click('[data-date="…"]')` or click a day cell by
  accessible name, then wait ~300ms before the shot.
