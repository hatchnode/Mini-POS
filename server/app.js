/**
 * The HTTP side of the server: serves the built app, signs devices and staff in, and syncs data.
 *
 *   GET    /api/status              what this device is to the server (set up? connected? who is signed in?)
 *   POST   /api/setup               first run: choose the owner password and connect this device
 *   POST   /api/device              connect a device with the owner password
 *   DELETE /api/device              disconnect this device
 *   POST   /api/password            change the owner password
 *   POST   /api/sign-in, /sign-out  staff sign-in with a PIN
 *   POST   /api/approve             a manager's PIN approves the next change from this device
 *   POST   /api/staff               add a staff member;  PATCH/DELETE /api/staff/:id;  POST /api/staff/reset
 *   GET    /api/sync?since=N        changes since revision N
 *   POST   /api/sync                send changes, get back what this device has not seen
 *   GET    /api/events              a stream that says when something changed (so screens update at once)
 */
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import {
  MIN_PASSWORD_LENGTH,
  PIN_PATTERN,
  RateLimiter,
  hashSecret,
  newToken,
  tokenHash,
  verifySecret,
} from './auth.js';
import { applyChanges } from './sync.js';

const COOKIE = 'mini_pos_device';
const YEAR_SECONDS = 365 * 24 * 3600;
const APPROVAL_MS = 2 * 60000;
const MAX_BODY = 64 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Too much data in one request'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'The request was not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const cookieValue = (req, name) =>
  (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([k]) => k === name)?.[1] || null;

const cleanName = (value, fallback) =>
  String(value || '')
    .trim()
    .slice(0, 40) || fallback;

/**
 * Build the request handler. `store` is the database, `staticDir` the built app (dist/),
 * `secure` whether the server is reached over HTTPS (cookies are then HTTPS-only).
 */
export function createApp({ store, staticDir = null, secure = false, now = () => Date.now() }) {
  const passwordTries = new RateLimiter({ max: 5, lockMs: 60000 });
  const pinTries = new RateLimiter({ max: 5, lockMs: 60000 });
  const approvals = new Map(); // token → { device, manager, until }
  const streams = new Set();

  const ownerHash = () => store.getMeta('owner_password');
  const staffList = () => store.all('staff');
  const pinHash = (staffId) =>
    store.db.prepare('SELECT pin_hash FROM staff_pins WHERE staff_id = ?').get(staffId)?.pin_hash;
  const setPin = (staffId, pin) =>
    store.db
      .prepare(
        'INSERT INTO staff_pins (staff_id, pin_hash) VALUES (?, ?) ON CONFLICT (staff_id) DO UPDATE SET pin_hash = excluded.pin_hash',
      )
      .run(staffId, hashSecret(pin));

  /** Tell every connected screen that something changed. */
  function announce() {
    for (const res of streams) res.write(`data: ${store.rev}\n\n`);
  }

  function deviceOf(req) {
    const token = cookieValue(req, COOKIE);
    if (!token) return null;
    const hash = tokenHash(token);
    const row = store.db
      .prepare('SELECT token_hash, name, staff_id FROM devices WHERE token_hash = ?')
      .get(hash);
    if (!row) return null;
    store.db.prepare('UPDATE devices SET last_seen = ? WHERE token_hash = ?').run(now(), hash);
    return { hash, name: row.name, staffId: row.staff_id };
  }

  /** 'open' | 'manager' | 'staff' | 'none' for a connected device. */
  function roleOf(device) {
    const staff = staffList();
    if (!staff.length) return 'open';
    const member = staff.find((s) => s.id === device.staffId);
    if (!member) return 'none';
    return member.role === 'manager' ? 'manager' : 'staff';
  }

  function connectDevice(res, name) {
    const token = newToken();
    store.db
      .prepare('INSERT INTO devices (token_hash, name, created_at, last_seen) VALUES (?, ?, ?, ?)')
      .run(tokenHash(token), cleanName(name, 'Device'), now(), now());
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${YEAR_SECONDS}${secure ? '; Secure' : ''}`,
    );
  }

  const signInDevice = (device, staffId) =>
    store.db.prepare('UPDATE devices SET staff_id = ? WHERE token_hash = ?').run(staffId, device.hash);

  function checkOwnerPassword(req, password) {
    const who = req.socket.remoteAddress || 'unknown';
    const wait = passwordTries.lockedFor(who, now());
    if (wait) throw new HttpError(429, `Too many wrong passwords. Try again in ${wait} seconds.`);
    if (!verifySecret(password, ownerHash())) {
      passwordTries.fail(who, now());
      throw new HttpError(403, 'Wrong owner password');
    }
    passwordTries.succeed(who);
  }

  function requirePassword(password) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpError(400, `The owner password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
  }

  function requirePin(pin) {
    if (!PIN_PATTERN.test(String(pin))) throw new HttpError(400, 'The PIN must be 4 digits');
  }

  function requireManager(device) {
    const role = roleOf(device);
    if (role !== 'open' && role !== 'manager') throw new HttpError(403, 'Needs a manager');
  }

  /** Check a PIN for a device, with a lock after repeated wrong tries. `match(pin)` returns the staff member or null. */
  function tryPin(device, pin, match) {
    const wait = pinTries.lockedFor(device.hash, now());
    if (wait) throw new HttpError(429, `Too many wrong PINs. Try again in ${wait} seconds.`);
    const member = PIN_PATTERN.test(String(pin)) ? match(String(pin)) : null;
    if (!member) {
      pinTries.fail(device.hash, now());
      throw new HttpError(403, 'Wrong PIN');
    }
    pinTries.succeed(device.hash);
    return member;
  }

  function status(device) {
    const staff = device ? staffList() : [];
    return {
      app: 'mini-pos',
      serverId: store.serverId,
      setUp: !!ownerHash(),
      connected: !!device,
      device: device?.name ?? null,
      staffId: device && staff.some((s) => s.id === device.staffId) ? device.staffId : null,
      rev: device ? store.rev : null,
    };
  }

  const nameTaken = (name, exceptId) =>
    staffList().some((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase());
  const managerCount = () => staffList().filter((s) => s.role === 'manager').length;

  const routes = {
    'GET /api/status': ({ device }) => status(device),

    'POST /api/setup': ({ body, res }) => {
      if (ownerHash()) throw new HttpError(409, 'This server is already set up');
      requirePassword(body.password);
      store.setMeta('owner_password', hashSecret(body.password));
      connectDevice(res, body.device);
      return { ok: true };
    },

    'POST /api/device': ({ req, res, body }) => {
      if (!ownerHash()) throw new HttpError(409, 'Set the server up first');
      checkOwnerPassword(req, body.password);
      connectDevice(res, body.device);
      return { ok: true };
    },

    'DELETE /api/device': ({ device, res }) => {
      store.db.prepare('DELETE FROM devices WHERE token_hash = ?').run(device.hash);
      res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
      return { ok: true };
    },

    'POST /api/password': ({ req, device, body }) => {
      requireManager(device);
      checkOwnerPassword(req, body.current);
      requirePassword(body.next);
      store.setMeta('owner_password', hashSecret(body.next));
      // Every other device has to connect again with the new password.
      store.db.prepare('DELETE FROM devices WHERE token_hash <> ?').run(device.hash);
      return { ok: true };
    },

    'POST /api/sign-in': ({ device, body }) => {
      const member = tryPin(device, body.pin, (pin) => {
        const found = staffList().find((s) => s.id === body.staffId);
        return found && verifySecret(pin, pinHash(found.id)) ? found : null;
      });
      signInDevice(device, member.id);
      return { ok: true, staffId: member.id };
    },

    'POST /api/sign-out': ({ device }) => {
      signInDevice(device, null);
      return { ok: true };
    },

    'POST /api/approve': ({ device, body }) => {
      const manager = tryPin(device, body.pin, (pin) =>
        staffList().find((s) => s.role === 'manager' && verifySecret(pin, pinHash(s.id))),
      );
      const token = newToken();
      approvals.set(token, { device: device.hash, until: now() + APPROVAL_MS });
      return { ok: true, approval: token, manager: { id: manager.id, name: manager.name } };
    },

    'POST /api/staff': ({ device, body }) => {
      requireManager(device);
      const name = cleanName(body.name, '');
      if (!name) throw new HttpError(400, 'Enter a name');
      if (nameTaken(name)) throw new HttpError(400, `There is already someone called "${name}"`);
      requirePin(body.pin);
      const first = staffList().length === 0;
      const member = { id: randomUUID(), name, role: first || body.role === 'manager' ? 'manager' : 'staff' };
      store.transaction(() => {
        store.put('staff', member.id, member);
        setPin(member.id, body.pin);
        // Whoever sets up sign-in is the first manager: sign their device in instead of locking it.
        if (first) signInDevice(device, member.id);
      });
      announce();
      return { ok: true, member, signedIn: first };
    },

    'PATCH /api/staff/:id': ({ device, body, id }) => {
      requireManager(device);
      const member = staffList().find((s) => s.id === id);
      if (!member) throw new HttpError(404, 'Staff member not found');
      if (body.pin !== undefined) requirePin(body.pin);
      if (body.role !== undefined && body.role !== member.role) {
        if (member.role === 'manager' && managerCount() === 1) {
          throw new HttpError(400, 'There must be at least one manager');
        }
        member.role = body.role === 'manager' ? 'manager' : 'staff';
        store.put('staff', id, member);
      }
      if (body.pin !== undefined) setPin(id, body.pin);
      announce();
      return { ok: true, member };
    },

    'DELETE /api/staff/:id': ({ device, id }) => {
      requireManager(device);
      const staff = staffList();
      const member = staff.find((s) => s.id === id);
      if (!member) throw new HttpError(404, 'Staff member not found');
      if (member.role === 'manager' && managerCount() === 1 && staff.length > 1) {
        throw new HttpError(400, 'Make someone else a manager first, or remove the other staff');
      }
      store.transaction(() => {
        store.put('staff', id, null);
        store.db.prepare('DELETE FROM staff_pins WHERE staff_id = ?').run(id);
        store.db.prepare('UPDATE devices SET staff_id = NULL WHERE staff_id = ?').run(id);
      });
      announce();
      return { ok: true, member };
    },

    // The way back in when the manager PIN is lost: only the owner password can do it.
    'POST /api/staff/reset': ({ req, body }) => {
      checkOwnerPassword(req, body.password);
      store.transaction(() => {
        for (const member of staffList()) store.put('staff', member.id, null);
        store.db.exec('DELETE FROM staff_pins; UPDATE devices SET staff_id = NULL;');
        const id = randomUUID();
        store.put('log', id, {
          id,
          at: now(),
          type: 'staff',
          text: 'Staff sign-in was reset with the owner password',
          staff: null,
        });
      });
      announce();
      return { ok: true };
    },

    'GET /api/sync': ({ query }) => {
      const since = Number(query.get('since')) || 0;
      return { serverId: store.serverId, rev: store.rev, changes: store.changesSince(since) };
    },

    'POST /api/sync': ({ device, body }) => {
      let who = roleOf(device);
      const approval = approvals.get(body.approval);
      if (approval) {
        approvals.delete(body.approval);
        if (approval.device === device.hash && approval.until > now() && who === 'staff') who = 'manager';
      }
      const before = store.rev;
      const result = applyChanges(store, who, { since: body.since, changes: body.changes });
      if (store.rev !== before) announce();
      return { serverId: store.serverId, ...result };
    },
  };

  /** Routes a device may call before it is connected. */
  const PUBLIC = new Set(['GET /api/status', 'POST /api/setup', 'POST /api/device', 'POST /api/staff/reset']);

  function openStream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`data: ${store.rev}\n\n`);
    streams.add(res);
    const beat = setInterval(() => res.write(': still here\n\n'), 25000);
    req.on('close', () => {
      clearInterval(beat);
      streams.delete(res);
    });
  }

  function serveStatic(req, res, path) {
    if (!staticDir) throw new HttpError(404, 'Not found');
    const wanted = normalize(join(staticDir, decodeURIComponent(path)));
    if (wanted !== staticDir && !wanted.startsWith(staticDir + sep)) throw new HttpError(403, 'Not allowed');
    let file = wanted;
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, 'index.html');
    if (!existsSync(file)) throw new HttpError(404, 'The app has not been built yet. Run: npm run build');
    const ext = extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // The page and the service worker must always be fresh; hashed assets can be kept.
      'Cache-Control': file.includes(`${sep}assets${sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  }

  async function handleApi(req, res, url) {
    let route = `${req.method} ${url.pathname}`;
    let id = null;
    const staffMatch = url.pathname.match(/^\/api\/staff\/([\w-]+)$/);
    if (staffMatch && staffMatch[1] !== 'reset') {
      id = staffMatch[1];
      route = `${req.method} /api/staff/:id`;
    }
    const isStream = route === 'GET /api/events';
    const handler = routes[route];
    if (!handler && !isStream) throw new HttpError(404, 'Not found');

    // Changes must come from the app itself, not from a form or script on another site.
    if (req.method !== 'GET') {
      if (req.headers['x-mini-pos'] !== '1') throw new HttpError(403, 'Not allowed');
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Not allowed');
    }

    const device = deviceOf(req);
    if (!device && !PUBLIC.has(route)) throw new HttpError(401, 'This device is not connected to the server');
    if (isStream) return openStream(req, res);

    const body = req.method === 'GET' ? {} : await readBody(req);
    const result = handler({ req, res, device, body, id, query: url.searchParams });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result));
  }

  return async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url.pathname);
      else throw new HttpError(405, 'Not allowed');
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) console.error(error);
      if (res.headersSent) return res.end();
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(
        JSON.stringify({
          ok: false,
          error: status === 500 ? 'Something went wrong on the server' : error.message,
        }),
      );
    }
  };
}
