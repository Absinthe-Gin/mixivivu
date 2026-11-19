# Mixivivu clone

A React + Vite + TypeScript reproduction of the public pages of
[mixivivu.com](https://mixivivu.com): Hạ Long cruise search and detail pages,
hotels, flight search, blog and content pages.

## Run

```bash
npm install
npm run dev        # http://localhost:5288/mixivivu-clone/
npm run build      # type-check + production build into dist/
npm run preview    # http://localhost:5289/mixivivu-clone/
```

The app uses a dedicated base path (`/mixivivu-clone/`) and port (5288) so it
does not clash with other local projects. Both are set in `app.config.ts`.

## AI assistant

An agent that searches ships and hotels, plans trips, keeps notes,
favorites and memories, and answers from blog/help content and uploaded
documents. Full-screen at `/tro-ly`, settings at `/tro-ly/cai-dat`, and the
"Hỏi Mixivivu" widget on every page. Actions that change data show a
confirmation card first.

```bash
cp .env.example .env     # set a provider: ANTHROPIC_API_KEY, AI_OLLAMA_MODEL or OPENAI_COMPAT_*
npm run dev              # API at /mixivivu-clone/api/*
npm run build && npm start   # production server on port 5290 (Node 22.18+, uses node:sqlite)
```

Without a provider the assistant answers in keyword-based basic mode.
Data is stored in `.data/mixivivu.db`. See `docs/ai-assistant/`.

## Tests

```bash
npm run test:unit                 # server + agent tests with a mock LLM
npx playwright install chromium   # once
npm run test:e2e                  # PW_PORT=5299 to use another dev port
```

Tests use a mock LLM or mocked streams, so they never make billed API calls.
To reuse an existing Chromium build instead of downloading one, set
`PW_CHROMIUM_PATH` to its executable.

## Data

All data is served as static JSON from `public/data` (a mock API).
`scripts/build-data.py` regenerates it from captured public API responses.
Product photos and hero videos are loaded from the source CDN and are not
stored in this repository.

## Docs

- `docs/website-inventory.md` — routes, components, interactions, data sources
- `docs/architecture.md` — structure and data flow
- `docs/implementation-plan.md` — milestones
- `docs/progress.md` — progress log, test results, known gaps
- `docs/ai-assistant/` — assistant architecture, schema, providers, tools, memory, RAG, security, API, testing, progress
- `docs/reference/` — screenshots of the source site

## Content and assets

Texts, images, logos and videos belong to Mixivivu and its partners. This
project assumes the repository owner is authorized to reproduce them.
