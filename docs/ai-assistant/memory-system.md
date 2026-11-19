# Memory system

Three layers, kept apart from conversation history.

| Layer | What | Where | Written by |
|---|---|---|---|
| Short-term | the current conversation, recent turns, unfinished requests, pending actions | `ai_messages` (+ `ai_action_confirmations`) | every turn |
| Long-term | preferences, facts, rules the user asked to keep | `ai_memories` kind preference/fact/rule | `save_memory` after the user confirms the card, or Settings → Bộ nhớ |
| Episodic | actions the assistant completed ("Đã tạo kế hoạch …") | `ai_memories` kind episode | executor, after a successful write, when memory is on |

## Rules

- Nothing is remembered automatically except the episodic action log.
  `save_memory` is described to the model as "only when the user
  explicitly asks", and it always needs confirmation, so the model cannot
  store inferred personal data on its own.
- Each memory keeps its `source` (`chat_confirmed`, `settings`,
  `action_log`), source conversation/message and timestamps.
- Users can list, edit, delete and clear memories (Settings, or by asking:
  `list_memories`, `forget_memory` — the latter confirmed).
- Turning memory off (Settings → Bộ nhớ) hides memory tools, stops
  episodes and stops injecting memories into the prompt. Stored memories
  remain until deleted.
- Limit: 500 memories per user, 500 characters each; duplicates are
  merged.

## Use in context

`MemoryService.relevant(userId, question)` returns all rules and
preferences, plus facts/episodes sharing words with the question, plus
the three latest episodes (max 12). They appear in the system prompt under
"What the user asked you to remember".

## Conversation context (short-term)

`ContextManager`:

- takes messages after the conversation's context reset point;
- keeps the last N (Settings → Trò chuyện, default 24), starting at a user
  message so tool call/result pairs stay intact;
- shortens tool results older than the latest user turn (800 chars);
- drops whole oldest turns until the estimate fits ~75% of the model's
  context window;
- adds up to 3 older messages that share ≥2 words with the question;
- inserts placeholder results for tool calls without one (paused or
  interrupted turns), so every provider accepts the transcript.

"Xoá ngữ cảnh" (clear context) records `context_reset_seq`: the history
stays visible but later turns ignore it.
