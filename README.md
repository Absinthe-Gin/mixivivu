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

The "Hỏi Mixivivu" chat widget answers questions about ships, hotels and how
to use the site, using Claude with tools over the site data.

```bash
cp .env.example .env     # then set ANTHROPIC_API_KEY
npm run dev              # chat API at /mixivivu-clone/api/chat
npm run build && npm start   # production server on port 5290 (Node 22.18+)
```

Without a key the assistant still works in a keyword-based basic mode.
See `docs/architecture.md` → AI assistant.

## Tests

```bash
npx playwright install chromium   # once
npm run test:e2e
```

Chat UI tests use a mocked stream, so they never make billed API calls.
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
- `docs/reference/` — screenshots of the source site

## Content and assets

Texts, images, logos and videos belong to Mixivivu and its partners. This
project assumes the repository owner is authorized to reproduce them.
