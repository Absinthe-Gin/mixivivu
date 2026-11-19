# Security

The model is never the security boundary. Every permission is checked by
the backend, whatever the model asks for.

## Identity and isolation

- Every API request resolves the user from the `mxv_sid` cookie
  (`HttpOnly`, `SameSite=Lax`, `Secure` behind HTTPS or with
  `COOKIE_SECURE=1`; token stored as sha256).
- Visitors get a guest account automatically; registering upgrades it in
  place and rotates the session; login rotates the session.
- Tools receive `ctx.userId` from the session. Tool schemas have no user id
  and reject unknown fields, so a model-supplied `user_id` fails
  validation.
- Every service query filters by owner; another user's id behaves exactly
  like a missing id (404).
- Documents: `owner_key IN ('public', <user>)` on every retrieval.

## Action control

| Group | Tools | Policy |
|---|---|---|
| A read-only | search, get, list, statistics | run immediately |
| B reversible write | add favorite, create/update trip, notes, memory | validated; confirmation when significant (or always, per user setting); `save_memory` always |
| C destructive | delete trip/notes/document/memory, remove favorite, bulk delete | always confirmed |

- A parked action stores the exact validated arguments and an args hash.
  The browser only sends `{decision}` for a confirmation id it owns.
- Confirmation transitions are compare-and-set; double clicks, replays and
  concurrent requests run the action at most once. Confirmations expire
  after 15 minutes.
- A new user message cancels pending actions ("how do I delete…" is not a
  permission to delete).
- Idempotency: `tool_call_id` is unique in `ai_tool_executions`;
  `client_message_id` is unique per conversation.

## Prompt injection

- System prompt: tool results, documents, blogs and web pages are data, not
  instructions.
- Retrieved text is wrapped with an "untrusted data" note.
- Even if the model follows injected text, destructive and significant
  writes still stop at the confirmation card, and no tool can run SQL,
  shell commands or read files: tools only call typed services.
- Covered by `prompt injection inside a document cannot bypass
  confirmation` (server/test/agent.test.ts).

## Limits

| Limit | Value |
|---|---|
| API requests per IP | 300/min (`API_RATE_LIMIT_PER_MIN`) |
| Messages per user and per IP | 30 / 5 min (`AI_RATE_LIMIT_MESSAGES`) |
| Login/register per IP | 20 / 5 min |
| Uploads per user | 20 / hour, 2 MB each, 50 documents |
| Message length | 4,000 characters; JSON body 64 KB |
| Tool calls per turn | user setting 1–12 (default 8) |
| Tool timeout | 20 s; provider timeout from config |

## CSRF

Writes (POST/PUT/PATCH/DELETE) need `X-Requested-With: mixivivu` (a custom
header cannot be sent cross-site without a CORS preflight, which the
server never grants) and, when present, an `Origin` matching the host.

## Secrets

- Provider API keys: environment variables, or encrypted in the DB with
  AES-256-GCM keyed by `AI_SECRET_KEY`. Without that variable the server
  refuses to store keys. Keys are never returned (only `…last4`).
- Only admins edit provider configs (`AI_ADMIN_USERNAMES`; if unset, the
  first registered account). Base URLs must be http(s).
- The browser never calls an LLM provider.

## Audit

`ai_audit_logs`: tool writes (`tool.execute`, `confirmation.execute`),
confirmation decisions, settings changes, memory edits, document
upload/delete, provider changes, logins. Users can read their own log in
Settings → Dữ liệu.

## Not covered / follow-ups

- Rate limiting is in memory (single process).
- No password reset or account deletion flow yet.
- No export tool; if one is added it must be group C.
