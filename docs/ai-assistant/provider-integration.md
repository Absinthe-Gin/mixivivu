# LLM providers

Business code depends on one interface, `LLMProvider`
(`server/ai/providers/types.ts`):

| Method | Use |
|---|---|
| `streamResponse(req)` | streamed text + structured tool calls (used by the orchestrator) |
| `generateResponse(req)` | plain completion, no tools |
| `generateWithTools(req)` | non-streamed completion with tools |
| `getAvailableModels()` | model list (with tool support when known) |
| `validateConfiguration()` | connectivity, model presence, tool support |

Messages, tool specs and tool calls use neutral types (`LLMMessage`,
`LLMToolSpec`, `ToolCall`); each adapter converts them to its wire format.
Errors are mapped to `ProviderError` kinds: `auth`, `rate_limit`,
`connection`, `timeout`, `bad_request`, `unsupported`, `unknown`.

## Adapters

| Type | File | Notes |
|---|---|---|
| `anthropic` | `anthropic.ts` | `@anthropic-ai/sdk` Messages streaming; tool results grouped into one user turn; system prompt cached. Temperature is not sent. |
| `openai_compatible` | `openaiCompatible.ts` | Chat Completions SSE; assembles tool-call argument fragments by index; works with OpenAI, OpenRouter, vLLM, LM Studio, Groq, Ollama `/v1`. |
| `ollama` | `ollama.ts` | native `/api/chat` NDJSON with `think: false` (no reasoning output, faster on small models); checks `/api/show` capabilities and refuses models without `tools`. |
| `mock` | `mock.ts` | scripted turns for tests; records every request. |

## Configuration

Two sources, merged by `ProviderService`:

**Environment** (deploy-time, read-only in the UI):

```
ANTHROPIC_API_KEY=...            # enables "env-anthropic"
AI_ANTHROPIC_MODEL=claude-opus-5-5
AI_OLLAMA_MODEL=qwen3.5:4b       # enables "env-ollama"
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_COMPAT_BASE_URL=https://openrouter.ai/api/v1   # enables "env-openai" (with model)
OPENAI_COMPAT_MODEL=...
OPENAI_COMPAT_API_KEY=...
AI_DEFAULT_PROVIDER=ollama       # id or type
AI_TIMEOUT_MS / AI_MAX_TOKENS / AI_TEMPERATURE
MIXIVIVU_CHAT_MODE=basic         # disable all providers (keyword answers)
```

**Settings → AI (admins)**: rows in `ai_provider_configs` with name, type,
base URL, default model, extra models users may pick, API key,
temperature, max tokens, context window, timeout, enabled, default. API
keys are encrypted with `AI_SECRET_KEY` (≥16 chars, required to store
keys) and only a 4-character hint is ever returned. Base URLs must be
http(s). Only admins can edit, because the server makes requests to these
URLs.

Users choose a provider/model among the enabled configs in Settings → AI;
an invalid choice falls back to the default.

## Adding a provider

1. Create `server/ai/providers/<name>.ts` extending `BaseProvider`; implement
   `streamResponse`, `getAvailableModels`, `validateConfiguration`. Use
   `this.signalFor(req)` for timeouts and `httpError`/`networkError` for
   error mapping. Emit `text` events, then one `tool_call` per call (with
   parsed arguments, or `parseError`), then exactly one `done`.
2. Add the type to `ProviderType`, `createProvider()` and the
   `provider_type` CHECK (new migration).
3. Optionally add env support in `envProviderConfigs()` and a choice in
   `ProviderAdmin.tsx`.
4. Add an adapter test with a local fake server (see
   `server/test/units.test.ts`).

## Ollama notes

- Pick a model whose capabilities include `tools` (`ollama show <model>`).
  Tested locally: `qwen3.5:4b` (correct arguments, ~2 min first call while
  loading, then seconds) and `qwen2.5:3b` (fast but sometimes misreads
  constraints, e.g. "dưới 4 triệu" as a minimum price).
- `AI_OLLAMA_CONTEXT` sets `num_ctx` (default 16384). The context manager
  budgets ~75% of it.
- Run the live check: `node server/test/live-ollama.manual.ts qwen3.5:4b`.

## Handling LLM errors

| Kind | Behaviour |
|---|---|
| `rate_limit`, `connection` | retried once after 1 s if nothing was streamed yet |
| `auth` on the first call of a turn | falls back to basic keyword mode (keeps the site usable without credentials) |
| `timeout`, `unsupported`, others | partial text stored with status `error`; user sees a Vietnamese message |
| `stop_reason = refusal` | short refusal text |
| `max_tokens` | answer kept as is |

Server logs carry the original error (`[ai] provider error …`).
