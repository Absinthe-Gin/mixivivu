# Progress

Last update: 2026-11-16. Branch: `main`, remote `origin` (GitHub).

## How to resume

1. `npm install`, then `npm run dev` → http://localhost:5288/mixivivu-clone/
2. Run `npm run test:e2e` (set `PW_CHROMIUM_PATH` to reuse a local Chromium).
3. Read "Open issues" below for the next work items.

## Milestones

### M1 — Foundation, survey, data (pushed)

- Commits: `69481ac` chore: initialize project, `4f601ae` docs: inventory + reference screenshots, `ff567e3` feat: datasets and static assets.
- Survey: 21 public routes (+95 ship, 237 hotel, 131 blog detail pages) from nav, footer and `_buildManifest.js`; admin area excluded.
- Data: public JSON endpoints captured and normalized to `public/data` (5.1 MB). Reviewer phone/e-mail removed.
- Check: `npm run build` passed.

### M2 — Services, design system, layout, pages (pushed)

- Commits: `56ea11e` services/hooks, `389f17b` shared components + header/footer, `96e31d9` home/listing/hotel/blog pages, `9533d62` detail pages, booking flows, flight, content pages.
- Check: `tsc -b` clean, production build passed, no runtime errors on any route.

### M3 — Visual QA and tests

- Commits: `b985c34` fix: header width, ship tag order, filter groups, hotel home sections; `16bb73e` test: Playwright suite.
- Visual comparison (Playwright, same viewport, source vs local):

| Page (1440px) | Source height | Clone height |
|---|---|---|
| `/` | 5946 | 5825 |
| `/tim-du-thuyen` | 3092 | 3100 |
| `/khach-san` | 6039 | 6277 |
| `/tim-ve-may-bay` | 3034 | 3048 |
| `/doanh-nghiep` | 2101 | 2113 |
| `/blog` | 2251 | 2220 |
| `/ve-chung-toi` | 3095 | 3121 |
| `/lien-he` | 1790 | 1753 |

  Header, search box, cards, filter sidebar, pagination, room picker, review
  block and footer were compared side by side at 1440px; tablet (768px) and
  mobile (390px) layouts were checked for overflow and stacking.
- Tests: `npm run test:e2e` → 34 passed (32 desktop, 2 mobile). Covers all
  routes without runtime errors, nav active state, home search → listing URL,
  star filter (45 results), sort order, pagination, empty state, room modal and
  totals, booking validation and success, review submit, contact validation
  messages, FAQ toggle, blog tabs, testimonials, flight search, mobile menu,
  no horizontal overflow on mobile.

### M4 — Docs and tablet polish

- Tablet: listing image height capped at 320px.
- Docs: `architecture.md`, `implementation-plan.md`, `progress.md`, README.

### M5 — AI assistant

- Chat widget on every page, server endpoint with Claude tool use
  (ship/hotel search and details, help search), streaming answers, basic
  keyword mode without credentials, rate limiting and input limits.
- Tests: 39 passed (chat UI with mocked stream, API validation, basic-mode
  answer, mobile full-screen). The AI mode was not exercised live: no Claude
  credentials on this machine. Set `ANTHROPIC_API_KEY` in `.env` to enable it.

### M6 — AI agent (branch `feat/ai-agent`)

- Chatbot replaced by an agent with providers, tools, confirmations, memory,
  RAG, accounts and SQLite. Details and results: `docs/ai-assistant/progress.md`.

## Open issues / known gaps

- Assistant Claude path untested live (no credentials); tested live with local Ollama.
- Flight results need a live fare provider; the clone shows the search summary
  and the hotline instead of inventing fares.
- Bookings, contact requests and reviews are stored in `localStorage` only (no backend).
- Hero videos and product images load from the source CDN; offline they fall back to the poster image.
- Category filter for Lan Hạ / Cát Bà returns 0 ships: every ship in the source
  data is in "Vịnh Hạ Long". The source page ignores this filter and shows all 95.
- The footer "Đã thông báo Bộ Công Thương" badge from the source was not
  reproduced: it is an official registration mark tied to the real business.
- Hotel reviews: the source endpoint returned no published hotel reviews.
