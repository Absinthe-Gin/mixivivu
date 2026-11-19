# Tool registry

Tools are declared as data plus handlers (`server/ai/tools/types.ts`) and
registered in `server/ai/tools/index.ts`. The orchestrator never mentions a
tool by name.

```ts
interface ToolDefinition<A> {
  name: string;                 // snake_case, unique
  description: string;          // model-facing
  category: string;             // Settings grouping (Vietnamese)
  label: string;                // status line while running
  parameters: JsonSchema;       // object schema, additionalProperties: false
  outputSchema?: JsonSchema;
  risk: 'read' | 'write' | 'destructive';      // groups A / B / C
  confirmation: 'never' | 'significant' | 'always';
  isSignificant?(args, ctx): boolean;          // for 'significant'
  preview?(args, ctx): ActionPreview;          // required for write/destructive
  execute(args, ctx): ToolOutput | Promise<ToolOutput>;
  onError?(err): string;                       // message returned to the model
  isAvailable?(services): boolean;             // hidden when false
  enabledByDefault?: boolean;                  // opt-in tools
  timeoutMs?: number;                          // default 20 s
}
```

`ctx` carries `userId` (from the session), `conversationId`, `messageId`,
`services`, `settings` and an abort `signal`. Arguments never contain a
user id; schemas reject unknown fields.

`ToolOutput` = `{ data, summary?, sources?, card?, episode?, auditTarget? }`:
`data` goes to the model (JSON, truncated at 12k chars), `summary` to the
step timeline, `sources` become numbered citations, `card` a result card,
`episode` an episodic memory line.

## Registry rules (enforced at registration)

- names are unique and snake_case; parameters are an object schema;
- `write`/`destructive` tools must have a `preview`;
- `read` tools cannot require confirmation;
- `destructive` tools are forced to `confirmation: 'always'`.

## Execution pipeline (`ToolExecutor`)

1. unknown tool → rejected;
2. disabled for this user (Settings, memory off, not configured) → rejected;
3. unparseable JSON → rejected;
4. schema validation (with safe coercion of `"2"`→2, `"true"`→true) →
   rejected with the list of errors so the model can fix the call;
5. same `tool_call_id` already handled → stored outcome returned
   (idempotency);
6. confirmation needed? `destructive` or `always` → yes; `write` +
   user policy `always` → yes; otherwise `isSignificant(args)`.
   `preview()` runs first (it also verifies the target exists and belongs
   to the user); the call is parked in `ai_action_confirmations`;
7. execute with timeout; store result; audit log for writes; episodic
   memory for successful writes when memory is on.

## Current tools

| Group | Tools |
|---|---|
| A (read) | `search_ships`, `get_ship_details`, `search_hotels`, `get_hotel_details`, `search_help`, `catalog_statistics`, `compare_items`, `list_favorites`, `list_trips`, `get_trip`, `search_notes`, `get_note`, `my_travel_summary`, `list_memories`, `search_documents`, `list_documents`, `read_document`, `web_search` (opt-in, needs backend) |
| B (write) | `add_favorite`, `create_trip`*, `update_trip`*, `add_trip_item`, `create_note`, `update_note` (* when content changes), `save_memory` (always) — * = confirmed under the default "significant" policy |
| C (destructive) | `remove_favorite`, `delete_trip`, `delete_notes` (1–20), `forget_memory`, `delete_document` — always confirmed |

## Adding a tool

1. Add a `ToolDefinition` in the relevant module (or a new
   `server/ai/tools/<module>Tools.ts`), using services only — never SQL.
2. Choose `risk` honestly; give write tools a `preview` with before/after
   `changes` and a `consequence`.
3. Register it in `createDefaultRegistry()`.
4. Add a label to nothing else: the UI reads `label`/`summary` from events.
5. Test: a mock-LLM turn that calls it (see `server/test/agent.test.ts`).

## Adding a business module

1. Migration for its tables (owner-scoped `user_id`).
2. A service in `server/domain/` whose every method takes `userId`.
3. Add it to `Services` (`server/ai/services.ts`).
4. Tools that call the service, registered as above.
5. Optionally a REST view (`/api/ai/my-data`) and a Settings panel.

## Debugging tool calling

- `ai_tool_executions` shows every call with arguments, status, error and
  duration: `SELECT tool_name, status, arguments, error FROM ai_tool_executions ORDER BY created_at DESC LIMIT 20;`
- `rejected` + "Invalid arguments" → schema mismatch; improve the
  description or parameter `description`s (small models need explicit
  units, e.g. "4 triệu = 4000000").
- Model never calls tools → check `validateConfiguration()` (Ollama
  `tools` capability) and that the tool is enabled for the user.
- Loops → `maxToolCalls` (Settings → Công cụ) caps calls per turn; the
  last call is made without tools.
- `MockProvider.requests` in tests shows the exact system prompt, messages
  and tool list sent.
