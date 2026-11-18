/**
 * Password hashing (scrypt), random ids/tokens and at-rest encryption for
 * provider API keys (AES-256-GCM keyed by AI_SECRET_KEY).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export const newId = () => randomUUID();
export const randomToken = () => randomBytes(32).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  const [scheme, salt, hash] = (stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

/** Stable JSON (sorted keys) so equal arguments hash equally. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function secretKey(): Buffer | null {
  const raw = process.env.AI_SECRET_KEY;
  return raw && raw.length >= 16 ? createHash('sha256').update(raw).digest() : null;
}

export const canEncryptSecrets = () => secretKey() !== null;

export function encryptSecret(plain: string): string {
  const key = secretKey();
  if (!key) throw new Error('AI_SECRET_KEY is not set (min 16 chars); refusing to store API keys in plain text.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`;
}

export function decryptSecret(encoded: string | null | undefined): string | undefined {
  const key = secretKey();
  if (!encoded || !key) return undefined;
  const [v, iv, tag, data] = encoded.split('.');
  if (v !== 'v1') return undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}
