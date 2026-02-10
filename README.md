# Alt1 Quest Helper

Frontend app to search and track RuneScape quests using Wiki and RuneMetrics data.

## Features

- Quest search with grouping/filters (`Alphabetical`, `Series`, `Length`, `Combat`, `Free/Members`)
- `Overview` and `Steps` quest views
- Local per-quest step progress persistence
- Player lookup (RuneMetrics) for quest/skill status
- Visual status indicators (`COMPLETED`, `STARTED`, `NOT_STARTED`)
- UI with sticky bars, toasts, and quick step navigation

## Stack

- HTML, CSS, JavaScript (ES Modules)
- No framework
- Integrations: RuneScape Wiki API + RuneMetrics

## Project Structure

```text
src/
  app/
    bootstrap/
    controllers/
    flow/
    state/
  features/
    player/
    progress/
    quests/
    search/
  shared/
    dom/
    ui/
  styles/
tests/
docs/
```

## How to Run

Start with a local server (example):

```bash
npx serve .
```

Then open `http://127.0.0.1:3000/index.html`.

## Scripts

```bash
npm install
npm run lint
npm run format:check
npm run format
npm test
```

## CI

GitHub Actions workflow:

- `.github/workflows/ci.yml`

Automatically runs:

- lint
- format check
- tests

## Notes

- The app is client-side and depends on external API availability.
- Some player API calls may be affected by CORS/latency, depending on endpoint behavior.
