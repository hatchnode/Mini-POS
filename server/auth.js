/**
 * Secrets and sessions for the server. Passwords and PINs are stored only as salted scrypt
 * hashes; device tokens are random and stored only as a SHA-256 hash, so a copy of the database
 * does not reveal a password, a PIN or a usable session.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const MIN_PASSWORD_LENGTH = 8;
export const PIN_PATTERN = /^\d{4}$/;

export function hashSecret(secret) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${scryptSync(String(secret), salt, 32).toString('base64')}`;
}

export function verifySecret(secret, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(String(secret), Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token) => createHash('sha256').update(String(token)).digest('hex');

/**
 * Slows down guessing: after `max` wrong tries for the same key, that key is locked for
 * `lockMs`. A correct try clears the count.
 */
export class RateLimiter {
  constructor({ max = 5, lockMs = 60000 } = {}) {
    this.max = max;
    this.lockMs = lockMs;
    this.entries = new Map();
  }

  /** Seconds left on the lock, or 0 when another try is allowed. */
  lockedFor(key, now = Date.now()) {
    const entry = this.entries.get(key);
    return entry && entry.until > now ? Math.ceil((entry.until - now) / 1000) : 0;
  }

  fail(key, now = Date.now()) {
    const entry = this.entries.get(key) || { count: 0, until: 0 };
    entry.count += 1;
    if (entry.count >= this.max) {
      entry.count = 0;
      entry.until = now + this.lockMs;
    }
    this.entries.set(key, entry);
  }

  succeed(key) {
    this.entries.delete(key);
  }
}
