# AI assistant — progress

Branch: `feat/ai-agent`. Last update: 2026-11-19.

## Scope

The brief targeted a "Personal App" (tasks, notes, projects, PostgreSQL).
This repository is the Mixivivu travel clone, with no database, accounts or
task module. Decision (confirmed with the owner): upgrade the existing
chatbot into a full agent on the travel domain — trip plans, notes,
favorites, memories and documents as the user's data — instead of adding an
unrelated productivity app.

## Milestones

### M1 — Architecture & foundation ✔
- SQLite via `node:sqlite` with migrations; accounts with guest sessions;
  domain services (favorites, trips, notes) scoped by owner.
- Provider interface and config service.
- Commit `3e42493`.
- Acceptance: migrations idempotent, owner scoping enforced — tested.

### M2 — LLM integration ✔
- Anthropic, OpenAI-compatible (SSE) and Ollama (native, `think:false`,
  tool-capability check) adapters; env + admin DB configs with encrypted
  keys; NDJSON streaming API.
- Commit `47c025b`, API in `2f98569`.

### M3 — Tool calling ✔
- Registry with risk groups, schemas, previews; validator with coercion;
  executor with idempotency, timeouts, audit; bounded agent loop with retry
  and basic-mode fallback.
- Commit `aecd9f8`.

### M4 — Application integration ✔
- 25 tools over catalog, favorites, trips, notes, statistics; confirmation
  workflow (park → decide → resume), cancellation on new message, expiry.
- Commits `b6f91dd`, `2f98569`.

### M5 — Memory & RAG ✔
- Long-term memory with explicit consent, episodic action log, settings
  CRUD; documents (TXT/MD/CSV/DOCX/XLSX), chunking, versioned embeddings,
  FTS5 + cosine fusion, public blog/help index, citations.
- Commit `b6f91dd`.

### M6 — Chat UI ✔
- `/tro-ly` (sidebar/drawer, search, pin, rename, archive, delete,
  streaming, tool steps, action cards, result cards, citations, Markdown
  with tables and code), `/tro-ly/cai-dat` (AI, chat, tools, memory,
  documents, data/audit, admin providers), site widget on the same agent.
- Commit `d90a6e5`.

### M7 — Security & testing ✔
- Commits `4adddaa`, `9bfbd68`.

### M8 — Finalization ✔
- Docs in `docs/ai-assistant/`, README and `.env.example` updated.

## Test results (2026-11-19)

- `npm run test:unit`: **36 passed, 0 failed**.
- `npm run test:e2e` (PW_PORT=5299, Ollama provider configured):
  **39 passed, 1 skipped** (basic-mode check skips when a provider exists).
  The two basic/real-backend API tests were also run against a server with
  `MIXIVIVU_CHAT_MODE=basic`: **2 passed**.
- `npm run build`: passed (`tsc -b` clean).
- Live end-to-end with local Ollama (`server/test/live-ollama.manual.ts`):
  - `qwen3.5:4b`: "du thuyền có bể sục dưới 4 triệu" → `search_ships
    {amenities:["bể sục"], max_price:4000000}` → 11 results → answer;
    "tạo kế hoạch Hạ Long cuối tuần 28–29/11, 2 người" → `create_trip` →
    confirmation card → confirm → row in `trips` → follow-up answer.
  - Browser (dev server, `qwen2.5:3b`): "Tạo ghi chú…" → `create_note` →
    note stored, result card shown (desktop and 390px mobile).

## Known issues

- Small local models make argument mistakes (`qwen2.5:3b` read "dưới 4
  triệu" as a minimum). Use ≥4B tool-capable models or a hosted provider.
  First call to `qwen3.5:4b` takes ~2 min while the model loads.
- Claude path untested live (no credentials on this machine); the adapter
  is covered by unit tests.
- PDF upload not supported yet.
- The existing `Modal` overlay class `bg-gray-900/60` produces no CSS
  (Tailwind opacity modifiers do not work with the `var(--…)` colors), so
  modal backdrops are transparent site-wide. Pre-existing; not changed.
- Rate limits are in memory (single process). No password reset or
  account deletion.
- The e2e suite can be flaky on the very first run while Vite compiles
  routes; reruns pass.
