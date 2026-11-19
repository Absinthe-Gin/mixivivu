# Testing

```bash
npm run test:unit      # node:test, server only, mock LLM, in-memory SQLite (~5 s)
npm run test:e2e       # Playwright UI + API against the dev server
npm test               # both
node server/test/live-ollama.manual.ts qwen3.5:4b   # manual, real local model
```

Automated tests never call a paid API: the server tests use
`MockProvider` (scripted turns, records every request) and the UI tests
mock the NDJSON streams. Basic-mode API checks skip when the dev server
has a provider configured.

If port 5288 is busy, run the e2e suite against another dev server:
`PW_PORT=5299 npx playwright test` (it starts `vite --port 5299` if none
is running). `PW_CHROMIUM_PATH` reuses a local Chromium.

## Coverage map

| Area | File | What |
|---|---|---|
| Storage, crypto, router, domain scoping | `server/test/foundation.test.ts` | migrations, scrypt, AES-GCM, owner checks |
| Agent loop | `server/test/agent.test.ts` | text turn, read tool loop, slot filling over 3 turns → confirmation → DB, cancel, double confirm (idempotent), new message cancels pending, prompt injection, malformed/unknown/out-of-scope arguments, tool-call limit, disabled tools, confirmation policies, provider retry/auth fallback/timeout, memory consent and off switch, citations |
| HTTP security | `server/test/security.test.ts` | CSRF header/origin, cookies, cross-user conversations/confirmations/data, history view, conversation management, admin-only providers and key secrecy, session rotation, validation, rate limit |
| Units | `server/test/units.test.ts` | validator, registry rules, context window/placeholders/reset/excerpts, Anthropic message grouping, OpenAI SSE tool-call assembly, Ollama tool calls + capability check, env configs, embeddings, chunker, parsers (DOCX/XLSX built in-test), RAG privacy/deletion/re-index |
| UI | `tests/assistant.spec.ts` | streaming, tool steps, confirmation card → confirm → history, Markdown tables/code/safe links, widget page context + expand, API CSRF/validation/isolation, basic mode, mobile drawer and composer |
| Site regression | `tests/app.spec.ts` | all existing routes and flows |

## Latest results

See [progress.md](progress.md).
