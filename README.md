# Scheddy

A personal PWA that answers "when am I free?" from your (and your spouse's shared) Google Calendars, and tracks monthly metrics like date nights and unbooked evenings.

Everything runs in your browser — no backend, no database. Your OAuth token and settings live in `localStorage` on your phone.

## Features

- **Free** — your next N open morning/afternoon/evening slots over the coming 60 days
- **Check** — "am I free this weekend / in July / June 20–25?" via quick chips, a month dropdown, and custom date pickers, with a free-slots view plus what's already booked
- **Metrics** — per-month counts for configurable keyword rules (e.g. events titled with "date" = date nights), plus unbooked evenings and free weekend days remaining
- **Settings** — pick which calendars block your time (all-day events like bill due dates never block), tune time windows, thresholds, and metric keywords

## One-time Google Cloud setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (e.g. "scheddy").
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → External → fill in the app name and your email. Leave it in **Testing** mode and add your own Gmail address as a test user. No verification needed.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**. Add authorized JavaScript origins:
   - `http://localhost:5173` (development)
   - your deployed origin, e.g. `https://scheddy.vercel.app`
5. Copy the client ID (`xxxxx.apps.googleusercontent.com`). Either paste it into the app's Settings page, or bake it in at build time via `.env`:

   ```
   VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   ```

Your wife's calendars are already shared with your account, so only your Google login is needed. Access tokens last ~1 hour; the app refreshes silently and may occasionally pop a one-tap Google prompt.

## Development

```bash
npm install
npm run icons     # regenerate PWA icons (committed in public/)
npm run dev       # http://localhost:5173
npm test          # vitest unit tests for the availability + metrics engines
npm run typecheck
npm run build     # production build in dist/
```

## Deploy

Any static host works. For Vercel: `vercel --prod` (framework preset: Vite). Remember to add the production origin to the OAuth client's authorized JavaScript origins.

On your phone, open the deployed URL and **Add to Home Screen** — it installs as a standalone app.

## How "free" is computed

- Only calendars you check in Settings block time.
- All-day events (`start.date`), events marked Free (`transparency: transparent`), and cancelled events never block.
- A morning/afternoon/evening window counts as free when its longest contiguous open stretch is at least the configured threshold (default 75%) of the window. Partially open windows show as e.g. "6–10pm · partly booked".
