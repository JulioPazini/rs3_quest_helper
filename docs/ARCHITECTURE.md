# Architecture Overview

## Goal

This project is a frontend-only quest helper for RuneScape/Alt1 with:

- quest list loading and filtering,
- quest quick-guide rendering,
- player RuneMetrics lookup,
- local progress persistence.

The architecture is organized by feature/domain to keep `app.js` focused on composition.

## Top-Level Structure

- `src/app.js`: composition root for runtime dependencies.
- `src/app/bootstrap/appBootstrap.js`: app startup flow and event wiring.
- `src/app/controllers/`: UI interaction handlers by domain.
- `src/features/`: business logic and data services by domain.
- `src/shared/dom/`: DOM element mapping.
- `tests/`: unit tests for feature modules.

## Module Responsibilities

### Composition and Bootstrap

- `src/app.js`
  - Collects DOM refs from `src/shared/dom/elements.js`.
  - Creates service/controller dependencies.
  - Exposes rendering and state helper functions to bootstrap/controllers.
  - Calls `bootstrapApp(...)`.

- `src/app/bootstrap/appBootstrap.js`
  - Initializes UI state from saved preferences.
  - Binds search/player/quest controls.
  - Initializes quest list and infinite-scroll behavior.
  - Keeps startup orchestration out of `app.js`.

### Controllers (Interaction Layer)

- `src/app/controllers/searchController.js`
  - Handles search submit/input/toggle/escape/outside/back.
  - Handles grouping filter changes.
  - Uses injected callbacks/services for rendering and navigation.

- `src/app/controllers/playerController.js`
  - Handles player lookup from Enter/click.
  - Prevents concurrent lookups.
  - Toggles lookup button loading state.

- `src/app/controllers/questController.js`
  - Handles steps interactions:
    - toggle show all/current
    - hide completed
    - reset/prev/next/jump current
    - keyboard shortcuts (`N`/`P`)

### Features (Business/Data Layer)

- `src/features/player/playerService.js`
  - RuneMetrics fetch with CORS-proxy strategy.
  - Player data caching and TTL handling.
  - Normalization helpers (`normalizeTitleKey`, `parseSkillValues`, error mapping).

- `src/features/search/grouping.js`
  - Normalization and ranking helpers for grouped list modes:
    - series
    - length
    - combat
    - membership

- `src/features/search/searchService.js`
  - Filtering/sorting pipeline for quest list based on:
    - player filter set
    - search query
    - selected group/sort mode

- `src/features/progress/progressService.js`
  - Step check index extraction/apply.
  - Quest progress save/load.
  - UI preferences save/load.

### Rendering and Parsing

- `src/features/quests/questRender.js`
  - Renders list rows, steps view, overview blocks.
  - Applies player quest/skill status markers in overview.

- `src/features/quests/questParser.js`
  - Parses quick-guide HTML and overview sections from wiki response.

- `src/features/quests/questService.js`
  - Resolves quest titles and fetches quick-guide pages.
  - Coordinates parsing and rendering callbacks.

- `src/features/quests/questList.js`
  - Loads/parses list of quests from wiki.
  - Caches list payload locally.

### Shared/UI Helpers

- `src/shared/dom/elements.js`
  - Centralized DOM element lookup.

- `src/shared/ui/uiControls.js`
  - Low-level UI helper operations and event binding wrappers.

- `src/app/state/state.js`
  - Central runtime app state object.

## Data Flow Summary

1. `bootstrapApp(...)` wires handlers and initializes quest list.
2. User interactions trigger controller handlers.
3. Controllers call feature services and rendering callbacks.
4. Render modules update DOM.
5. Progress/preferences persist via `progressService`.

## Testing Strategy

- Unit tests target pure feature modules:
  - `tests/grouping.test.mjs`
  - `tests/searchService.test.mjs`
  - `tests/playerService.test.mjs`
  - `tests/progressService.test.mjs`

This keeps regressions detectable without browser-level integration tests.

## Current Tradeoffs

- `src/app/state/state.js` remains a shared mutable state object for speed/simplicity.
- Some render paths still rely on controlled `innerHTML` for wiki-derived markup.
- No build step/framework; architecture favors modular vanilla JS.

## Next Refactor Candidates

- Split render concerns further (`render/search`, `render/overview`, `render/steps`).
- Add integration tests for core user flows.
- Add lint/format CI checks to protect module boundaries and style consistency.
