/**
 * Validates model-supplied tool arguments against the tool's JSON Schema
 * (the subset our tools use). Small local models often send "2" for 2 or
 * "true" for true, so scalar strings are coerced where unambiguous; anything
 * else is reported back to the model so it can correct the call.
 */
import type { JsonSchema } from '../providers/types.ts';

export interface ValidationOutcome {
  ok: boolean;
  value: Record<string, unknown>;
  errors: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateArgs(schema: JsonSchema, input: unknown): ValidationOutcome {
  const errors: string[] = [];
  const value = check(schema, input, '', errors);
  return { ok: errors.length === 0, value: (value ?? {}) as Record<string, unknown>, errors };
}

function check(schema: JsonSchema, v: unknown, path: string, errors: string[]): unknown {
  const at = path || 'arguments';
  const type = schema.type as string | undefined;

  if (type === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      errors.push(`${at}: must be an object`);
      return undefined;
    }
    const props = (schema.properties ?? {}) as Record<string, JsonSchema>;
    const out: Record<string, unknown> = {};
    for (const key of (schema.required ?? []) as string[]) {
      const val = (v as Record<string, unknown>)[key];
      if (val === undefined || val === null || val === '') errors.push(`${path ? `${path}.` : ''}${key}: is required`);
    }
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      const sub = props[key];
      if (!sub) {
        if (schema.additionalProperties === false) errors.push(`${path ? `${path}.` : ''}${key}: unknown field`);
        continue;
      }
      // Optional fields sent as null are treated as absent.
      if (val === null && !((schema.required ?? []) as string[]).includes(key)) continue;
      const checked = check(sub, val, path ? `${path}.${key}` : key, errors);
      if (checked !== undefined) out[key] = checked;
    }
    return out;
  }

  if (type === 'array') {
    if (!Array.isArray(v)) {
      errors.push(`${at}: must be an array`);
      return undefined;
    }
    if (typeof schema.minItems === 'number' && v.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items`);
    if (typeof schema.maxItems === 'number' && v.length > schema.maxItems) errors.push(`${at}: at most ${schema.maxItems} items`);
    const items = schema.items as JsonSchema | undefined;
    return items ? v.map((x, i) => check(items, x, `${at}[${i}]`, errors)) : v;
  }

  if (type === 'string') {
    if (typeof v === 'number') v = String(v);
    if (typeof v !== 'string') {
      errors.push(`${at}: must be a string`);
      return undefined;
    }
    const s = v.trim();
    if (typeof schema.minLength === 'number' && s.length < schema.minLength) errors.push(`${at}: at least ${schema.minLength} characters`);
    if (typeof schema.maxLength === 'number' && s.length > schema.maxLength) errors.push(`${at}: at most ${schema.maxLength} characters`);
    if (Array.isArray(schema.enum) && !schema.enum.includes(s)) errors.push(`${at}: must be one of ${schema.enum.join(', ')}`);
    if (schema.format === 'date' && (!DATE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`)))) errors.push(`${at}: must be a date YYYY-MM-DD`);
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(s)) errors.push(`${at}: invalid format`);
    return s;
  }

  if (type === 'number' || type === 'integer') {
    let n = v;
    if (typeof n === 'string' && n.trim() !== '' && Number.isFinite(Number(n))) n = Number(n);
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      errors.push(`${at}: must be a number`);
      return undefined;
    }
    if (type === 'integer' && !Number.isInteger(n)) errors.push(`${at}: must be an integer`);
    if (typeof schema.minimum === 'number' && n < schema.minimum) errors.push(`${at}: must be >= ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && n > schema.maximum) errors.push(`${at}: must be <= ${schema.maximum}`);
    return n;
  }

  if (type === 'boolean') {
    if (v === 'true' || v === 'false') v = v === 'true';
    if (typeof v !== 'boolean') {
      errors.push(`${at}: must be true or false`);
      return undefined;
    }
    return v;
  }

  return v;
}
