import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { q1 } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
const JWT_EXPIRES = '30d';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error('[FATAL] JWT_SECRET must be set in production. Refusing to start.');
  process.exit(1);
}

export interface AuthPayload {
  uid: string;
  role: 'admin' | 'manager' | 'teacher';
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

export const signToken = (p: AuthPayload) => jwt.sign(p, JWT_SECRET, { expiresIn: JWT_EXPIRES });
export const decodeToken = (t: string) => jwt.verify(t, JWT_SECRET) as AuthPayload;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthPayload }
  }
}

// Tiny TTL cache so we don't hit Postgres on every request just to check is_active
const userCache = new Map<string, { active: boolean; role: AuthPayload['role']; until: number }>();
const CACHE_TTL_MS = 15_000;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Не авторизован' });
  let payload: AuthPayload;
  try {
    payload = decodeToken(token);
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  // Verify account is still active (token may outlive a disable)
  const now = Date.now();
  let cached = userCache.get(payload.uid);
  if (!cached || cached.until < now) {
    try {
      const row = await q1<{ is_active: boolean; role: AuthPayload['role'] }>(
        'select is_active, role from users where id = $1',
        [payload.uid],
      );
      if (!row) return res.status(401).json({ error: 'Аккаунт не найден' });
      cached = { active: row.is_active, role: row.role, until: now + CACHE_TTL_MS };
      userCache.set(payload.uid, cached);
    } catch {
      // DB hiccup — fall back to JWT-only check (don't lock user out for transient errors)
      cached = { active: true, role: payload.role, until: now + 5_000 };
    }
  }
  if (!cached.active) return res.status(403).json({ error: 'Аккаунт отключён' });

  // Use latest role from DB, not the (possibly stale) one from JWT
  req.user = { uid: payload.uid, role: cached.role };
  next();
}

export function requireRole(...roles: AuthPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

// Allow other modules to invalidate the cache (e.g. when role/is_active changes)
export function invalidateUserCache(uid: string) {
  userCache.delete(uid);
}
