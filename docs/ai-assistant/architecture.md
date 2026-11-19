# AI assistant — architecture

The assistant is an agent inside the Mixivivu clone. It talks with the
user, reads the site catalog and the user's own data, and performs actions
(favorites, trip plans, notes, memories, documents) through a controlled
tool layer. Everything runs in the existing Node server: Vite middleware in
development, `server/serve.ts` in production. There is no separate service.

## Scope decision

The original brief described a "Personal App" with tasks, notes and
projects. This repository is a travel site, so the assistant works on the
travel domain instead: trip plans take the role of tasks/projects, and
notes, favorites and uploaded documents are the personal data. The
architecture (providers, tools, memory, RAG, confirmations) is
domain-neutral; adding another domain module is described in
[tool-registry.md](tool-registry.md#adding-a-business-module).

## Components

```
browser
  src/features/assistant/         ChatWidget (every page), /tro-ly (full screen), /tro-ly/cai-dat
        │  fetch + NDJSON stream, session cookie, X-Requested-With header
        ▼
server/api.ts                     routing, CSRF, rate limits, JSON errors
  ├─ /api/auth/*                  server/auth/authService.ts (guest + accounts, cookie sessions)
  └─ /api/ai/*                    server/ai/routes.ts
        │
        ▼
server/ai/orchestrator/orchestrator.ts      agent loop (runTurn, decide)
  ├─ context/contextManager.ts              what the model sees (window, excerpts, memories)
  ├─ orchestrator/systemPrompt.ts           behaviour only, no business rules
  ├─ providers/*                            LLMProvider: anthropic | openai_compatible | ollama | mock
  └─ orchestrator/toolExecutor.ts           validation → permission → confirmation → execute → audit
        └─ tools/*  (registry)              catalogTools, travelTools, knowledgeTools
              └─ services                   domain/*Service, memory, rag, conversations…
                    └─ shared/db.ts         SQLite (node:sqlite), migrations
```

### Request flow (one turn)

1. `POST /api/ai/conversations/:id/messages` → session user resolved by
   `AuthService`; the conversation must belong to that user.
2. Pending confirmations in that conversation are cancelled (a new message
   declines them), then the user message is stored.
3. `ProviderService.resolve` picks the provider/model from the user's
   settings (falls back to the default; none → basic keyword mode).
4. Loop, bounded by `maxToolCalls`:
   - `ContextManager.build` → system prompt + windowed transcript;
   - `provider.streamResponse` → text deltas are streamed to the browser,
     structured tool calls are collected;
   - the assistant message (text + tool calls + token usage) is stored;
   - each tool call goes through `ToolExecutor` → result stored as a
     `tool` message, step status streamed;
   - a call that needs approval creates an `ai_action_confirmations` row
     and the turn pauses (`done` with `awaitingConfirmation: true`).
5. `POST /api/ai/confirmations/:id {decision}` runs (or cancels) the parked
   call with the stored arguments, stores the result and resumes the loop.

Tool calls only come from the provider's structured tool-calling channel.
Free text is never parsed for commands.

## Module layout

| Path | Responsibility |
|---|---|
| `server/shared/` | DB + migrations, HTTP helpers, crypto, rate limiter |
| `server/auth/` | accounts, guest sessions, admin role |
| `server/domain/` | favorites, trips, notes services (owner-scoped SQL) |
| `server/catalog.ts` | read-only catalog, help index, statistics, public corpus |
| `server/ai/providers/` | provider interface, adapters, config service |
| `server/ai/tools/` | tool contract, registry, validator, tool modules |
| `server/ai/orchestrator/` | agent loop, executor, events, system prompt |
| `server/ai/context/` | context selection |
| `server/ai/conversations/` | conversations/messages, execution records, UI history view |
| `server/ai/memory/` | long-term and episodic memory |
| `server/ai/rag/` | parsers, chunking, embeddings, hybrid search |
| `server/ai/security/` | confirmations, audit log |
| `server/ai/settings/` | per-user settings |
| `server/ai/web/` | optional web search backend |
| `src/features/assistant/` | UI: pages, components, hooks, API client, types |

## Streaming protocol

NDJSON, one event per line (`server/ai/orchestrator/events.ts`):
`conversation`, `status`, `message`, `text`, `tool_start`, `tool_end`,
`confirmation`, `confirmation_update`, `card`, `citations`, `done`,
`error`. Reasoning traces and system prompts are never sent. Closing the
request (the stop button) aborts the provider call; the partial answer is
stored with status `stopped`.

## Related documents

[database-schema.md](database-schema.md) ·
[provider-integration.md](provider-integration.md) ·
[tool-registry.md](tool-registry.md) · [memory-system.md](memory-system.md) ·
[rag-pipeline.md](rag-pipeline.md) · [security.md](security.md) ·
[api-reference.md](api-reference.md) · [testing.md](testing.md) ·
[progress.md](progress.md)
