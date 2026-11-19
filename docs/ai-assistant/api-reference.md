# API reference

Base: `{APP_BASE_PATH}api` (`/mixivivu-clone/api`). JSON in and out; errors
are `{ "error": "<Vietnamese message>", "code": "<code>" }` with an HTTP
status. Writes need the header `X-Requested-With: mixivivu`. Identity comes
from the session cookie (a guest session is created on first request).

## Auth

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/auth/me` | — | `{ user }` |
| POST | `/auth/register` | `{ username, password, displayName? }` | `{ user }` (upgrades the guest) |
| POST | `/auth/login` | `{ username, password }` | `{ user }` |
| POST | `/auth/logout` | — | `{ ok }` |

## Conversations

| Method | Path | Notes |
|---|---|---|
| GET | `/ai/conversations?q=&archived=1` | pinned first, then recent; `q` searches titles and messages |
| POST | `/ai/conversations` | `{ title? }` |
| GET | `/ai/conversations/:id` | `{ conversation, messages }` — UI view: user/assistant messages with `steps` and `confirmations` |
| PATCH | `/ai/conversations/:id` | `{ title?, pinned?, archived? }` |
| DELETE | `/ai/conversations/:id` | soft delete |
| POST | `/ai/conversations/:id/clear-context` | later turns ignore earlier messages |
| POST | `/ai/conversations/:id/messages` | `{ content, clientMessageId?, attachments?: string[], appContext?: { path, title } }` → NDJSON stream |
| POST | `/ai/confirmations/:id` | `{ decision: "confirm" \| "cancel" }` → NDJSON stream; 409 if already decided |

### Stream events

```jsonc
{"type":"conversation","conversation":{"id":"…","title":"…"}}
{"type":"status","text":"Đang phân tích yêu cầu…"}
{"type":"text","text":"…"}                          // answer delta
{"type":"message","id":"…"}                         // a model step was stored
{"type":"tool_start","callId":"…","name":"search_ships","label":"Đang tìm du thuyền…"}
{"type":"tool_end","callId":"…","name":"search_ships","status":"succeeded","summary":"Đã tìm thấy 11 du thuyền"}
{"type":"confirmation","confirmation":{"id":"…","toolName":"delete_notes","preview":{…},"status":"pending","expiresAt":"…"}}
{"type":"confirmation_update","id":"…","status":"confirmed"}
{"type":"card","card":{"kind":"trip","title":"…","fields":[…]}}
{"type":"citations","citations":[{"n":1,"title":"…","link":"/blog-detail/…","sourceType":"blog"}]}
{"type":"done","messageId":"…","mode":"ai","awaitingConfirmation":false,"usage":{…},"model":"…"}
{"type":"error","message":"…","code":"timeout"}
```

## Settings and tools

| Method | Path | Notes |
|---|---|---|
| GET/PUT | `/ai/settings` | fields: `memoryEnabled`, `responseLanguage` auto/vi/en, `responseStyle` concise/balanced/detailed, `providerId`, `model`, `contextMessages` 4–60, `maxToolCalls` 1–12, `streaming`, `confirmWrites` always/significant, `disabledTools`, `enabledTools` |
| GET | `/ai/tools` | registry with group, risk, confirmation, enabled |
| GET | `/ai/providers` | users: id/name/models; admins: full config without keys |
| POST | `/ai/providers` | admin; `{ name, type, baseUrl?, model, models?, apiKey?, temperature?, maxTokens?, contextWindow?, timeoutMs? }` |
| PATCH/DELETE | `/ai/providers/:id` | admin; `apiKey: null` clears, omitted keeps; `isDefault: true` |
| POST | `/ai/providers/:id/validate` | admin; `{ result, models }` |

## Memory, documents, data

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/ai/memories` | POST `{ kind: preference/fact/rule, content }` |
| PATCH/DELETE | `/ai/memories/:id` | |
| DELETE | `/ai/memories` | clear all |
| GET | `/ai/documents` | user uploads |
| POST | `/ai/documents` | `{ filename, data: <base64> }` (≤ 2 MB) |
| DELETE | `/ai/documents/:id` | removes from the index |
| GET | `/ai/my-data` | favorites, trips, notes |
| GET | `/ai/audit?limit=` | the user's audit entries |
