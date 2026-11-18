/**
 * Accounts and cookie sessions. Every API request resolves its user here;
 * the identity used by AI tools always comes from this session, never from
 * request bodies or model output.
 *
 * Visitors get a guest account on first use (so the chat works without
 * sign-up). Registering upgrades the current guest in place, keeping its
 * conversations and travel data.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type Db, now, transaction } from '../shared/db.ts';
import { hashPassword, newId, randomToken, sha256, verifyPassword } from '../shared/crypto.ts';
import { ApiError, parseCookies } from '../shared/http.ts';

export const SESSION_COOKIE = 'mxv_sid';
const SESSION_TTL_MS = 30 * 24 * 3600_000;

export interface AuthUser {
  id: string;
  username: string | null;
  displayName: string | null;
  role: 'user' | 'admin';
  isGuest: boolean;
}

interface UserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  role: 'user' | 'admin';
  is_guest: number;
  password_hash: string | null;
}

const toUser = (r: UserRow): AuthUser => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  role: r.role,
  isGuest: r.is_guest === 1,
});

export class AuthService {
  private readonly db: Db;
  private readonly cookiePath: string;

  constructor(db: Db, cookiePath = '/') {
    this.db = db;
    this.cookiePath = cookiePath;
  }

  /** User of the request's session, or null. */
  current(req: IncomingMessage): AuthUser | null {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    const row = this.db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ?`,
      )
      .get(sha256(token), now()) as UserRow | undefined;
    return row ? toUser(row) : null;
  }

  /** Current user, creating a guest account + session when there is none. */
  ensure(req: IncomingMessage, res: ServerResponse): AuthUser {
    const existing = this.current(req);
    if (existing) return existing;
    const id = newId();
    const t = now();
    this.db.prepare('INSERT INTO users (id, role, is_guest, created_at, updated_at) VALUES (?, ?, 1, ?, ?)').run(id, 'user', t, t);
    this.startSession(id, req, res);
    return { id, username: null, displayName: null, role: 'user', isGuest: true };
  }

  register(req: IncomingMessage, res: ServerResponse, username: string, password: string, displayName?: string): AuthUser {
    validateCredentials(username, password);
    return transaction(this.db, () => {
      if (this.db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
        throw new ApiError(409, 'Tên đăng nhập đã được sử dụng.', 'username_taken');
      }
      const role = this.roleFor(username);
      const t = now();
      const guest = this.current(req);
      let id: string;
      if (guest?.isGuest) {
        id = guest.id;
        this.db
          .prepare('UPDATE users SET username = ?, password_hash = ?, display_name = ?, role = ?, is_guest = 0, updated_at = ? WHERE id = ?')
          .run(username, hashPassword(password), displayName ?? null, role, t, id);
        // Rotate the session so a token captured while anonymous cannot ride the new account.
        this.endSession(req);
      } else {
        id = newId();
        this.db
          .prepare('INSERT INTO users (id, username, password_hash, display_name, role, is_guest, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
          .run(id, username, hashPassword(password), displayName ?? null, role, t, t);
      }
      this.startSession(id, req, res);
      return toUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow);
    });
  }

  login(req: IncomingMessage, res: ServerResponse, username: string, password: string): AuthUser {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ? AND is_guest = 0').get(username) as UserRow | undefined;
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw new ApiError(401, 'Sai tên đăng nhập hoặc mật khẩu.', 'bad_credentials');
    }
    this.endSession(req);
    this.startSession(row.id, req, res);
    return toUser(row);
  }

  logout(req: IncomingMessage, res: ServerResponse): void {
    this.endSession(req);
    res.setHeader('Set-Cookie', this.cookie('', 0, req));
  }

  private roleFor(username: string): 'user' | 'admin' {
    const admins = (process.env.AI_ADMIN_USERNAMES ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (admins.length) return admins.includes(username.toLowerCase()) ? 'admin' : 'user';
    // No admin list configured: the first registered account administers this install.
    return this.db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get() ? 'user' : 'admin';
  }

  private startSession(userId: string, req: IncomingMessage, res: ServerResponse) {
    const token = randomToken();
    const t = new Date();
    this.db
      .prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
      .run(sha256(token), userId, t.toISOString(), new Date(t.getTime() + SESSION_TTL_MS).toISOString(), t.toISOString());
    res.setHeader('Set-Cookie', this.cookie(token, SESSION_TTL_MS / 1000, req));
  }

  private endSession(req: IncomingMessage) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token));
  }

  private cookie(value: string, maxAgeSec: number, req: IncomingMessage) {
    const secure = process.env.COOKIE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https';
    return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=${this.cookiePath}; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeSec)}${secure ? '; Secure' : ''}`;
  }
}

function validateCredentials(username: string, password: string) {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    throw new ApiError(400, 'Tên đăng nhập gồm 3-32 ký tự chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.', 'validation');
  }
  if (password.length < 8 || password.length > 128) throw new ApiError(400, 'Mật khẩu cần 8-128 ký tự.', 'validation');
}
