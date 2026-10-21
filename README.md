# 70.3 Ready v2 (GitHub version)

A training app for IRONMAN 70.3 North Carolina, Oct 16 2027.

- `index.html`, `plan.js`, `fit.js`: the app, served by GitHub Pages.
- `callback.html`: where Whoop sends you back during the one-time connect.
- `scripts/sync.mjs`: runs in GitHub Actions every morning and pulls Whoop (and optionally Intervals.icu) data.
- `data/`: that data, encrypted with your APP_PASSPHRASE. It is unreadable without it, even though the repo is public.
- `.github/workflows/sync.yml`: the daily schedule (11:00 UTC) and the "Run workflow" button.

Required secrets: `APP_PASSPHRASE`, `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`. Optional: `INTERVALS_ATHLETE_ID`, `INTERVALS_API_KEY`.
