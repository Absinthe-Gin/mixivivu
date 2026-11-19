/**
 * Tool contract. A tool is data (name, schema, risk, confirmation policy)
 * plus handlers. The orchestrator never special-cases a tool by name: it
 * validates arguments, applies the policy and calls `execute`.
 */
import type { JsonSchema } from '../providers/types.ts';
import type { Services } from '../services.ts';
import type { UserSettings } from '../settings/settingsService.ts';

/** A = read-only, B = reversible write, C = destructive / high impact. */
export type ToolRisk = 'read' | 'write' | 'destructive';
export const RISK_GROUP: Record<ToolRisk, 'A' | 'B' | 'C'> = { read: 'A', write: 'B', destructive: 'C' };

/**
 * - `never`: runs immediately (read tools only).
 * - `significant`: asks when `isSignificant(args)` is true, or always when the
 *   user's policy is "always confirm writes".
 * - `always`: every call needs the user's explicit confirmation.
 * Destructive tools are forced to `always` by the registry.
 */
export type ConfirmationPolicy = 'never' | 'significant' | 'always';

export interface ToolContext {
  userId: string;
  conversationId: string;
  messageId: string;
  services: Services;
  settings: UserSettings;
  signal: AbortSignal;
}

export interface Citation {
  n: number;
  title: string;
  link?: string;
  sourceType: 'blog' | 'help' | 'upload' | 'web' | 'catalog';
  documentId?: string;
  snippet?: string;
}

/** Card the UI renders under the answer after an action (e.g. the trip that was created). */
export interface ResultCard {
  kind: 'trip' | 'note' | 'favorite' | 'memory' | 'document' | 'list';
  title: string;
  subtitle?: string;
  link?: string;
  fields?: { label: string; value: string }[];
}

export interface ToolOutput {
  /** JSON-serialisable payload returned to the model. */
  data: unknown;
  /** One-line, user-facing status ("Đã tìm thấy 3 du thuyền"). */
  summary?: string;
  sources?: Omit<Citation, 'n'>[];
  card?: ResultCard;
  /** Episodic memory line recorded after a successful write (if memory is on). */
  episode?: string;
  /** Short human-readable target for the audit log. */
  auditTarget?: string;
}

export interface ActionPreview {
  title: string;
  target?: string;
  changes?: { field: string; before?: string | null; after?: string | null }[];
  consequence: string;
  risk: ToolRisk;
}

export interface ToolDefinition<A extends object = Record<string, unknown>> {
  name: string;
  description: string;
  /** Category shown in Settings ("Du thuyền & khách sạn", "Ghi chú"...). */
  category: string;
  /** Status line while running ("Đang tìm du thuyền…"). */
  label: string;
  parameters: JsonSchema;
  outputSchema?: JsonSchema;
  risk: ToolRisk;
  confirmation: ConfirmationPolicy;
  isSignificant?: (args: A, ctx: ToolContext) => boolean;
  /** Builds the confirmation card. Required for write/destructive tools; may throw (e.g. not found). */
  preview?: (args: A, ctx: ToolContext) => ActionPreview;
  execute: (args: A, ctx: ToolContext) => Promise<ToolOutput> | ToolOutput;
  /** Turns a handler error into the message given back to the model. */
  onError?: (err: unknown) => string;
  /** Hidden from the model when false (e.g. web search without a configured backend). */
  isAvailable?: (services: Services) => boolean;
  enabledByDefault?: boolean;
  timeoutMs?: number;
}

// Registry stores tools with erased argument types.
export type AnyTool = ToolDefinition<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
