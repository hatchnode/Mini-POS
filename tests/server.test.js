import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { RateLimiter, hashSecret, verifySecret } from '../server/auth.js';
import { checkChange } from '../server/rules.js';
import { Store } from '../server/store.js';
import { applyChanges } from '../server/sync.js';

const line = (id, qty, sent = 0) => ({ id, itemId: 'i', name: 'Tea', price: 300, qty, sent, note: '' });
const order = (id, no, extra = {}) => ({
  id,
  no,
  status: 'open',
  createdAt: 1,
  lines: [],
  dishes: [],
  ...extra,
});
const push = (store, who, changes, since = 0) => applyChanges(store, who, { since, changes });
const change = (collection, doc, baseRev = 0, id = doc.id) => ({ collection, id, doc, baseRev });

describe('secrets', () => {
  it('stores passwords as salted hashes and checks them', () => {
    const a = hashSecret('correct horse');
    expect(a).not.toContain('correct horse');
    expect(a).not.toBe(hashSecret('correct horse'));
    expect([verifySecret('correct horse', a), verifySecret('wrong', a), verifySecret('x', '')]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('locks after repeated wrong tries, then lets go', () => {
    const limiter = new RateLimiter({ max: 3, lockMs: 1000 });
    limiter.fail('k', 0);
    limiter.fail('k', 0);
    expect(limiter.lockedFor('k', 0)).toBe(0);
    limiter.fail('k', 0);
    expect(limiter.lockedFor('k', 500)).toBe(1);
    expect(limiter.lockedFor('k', 1001)).toBe(0);
    expect(limiter.lockedFor('other', 500)).toBe(0);
  });
});

describe('what a device may change', () => {
  const allowed = (...args) => checkChange(...args) === null;
  const sent = order('o', 1, { lines: [line('l', 2, 2)], dishes: [{ id: 'd' }] });

  it('lets anyone do anything while no staff are set up, and nobody when not signed in', () => {
    expect(allowed('open', 'settings', 'settings', {}, { name: 'X' })).toBe(true);
    expect(allowed('none', 'orders', 'o', null, order('o', 1))).toBe(false);
  });

  it('lets staff take orders and payments', () => {
    expect(allowed('staff', 'orders', 'o', null, order('o', 1))).toBe(true);
    expect(allowed('staff', 'orders', 'o', sent, { ...sent, paidAt: 5, paidAmount: 600 })).toBe(true);
    expect(allowed('staff', 'orders', 'o', sent, { ...sent, lines: [line('l', 3, 2)] })).toBe(true);
    expect(allowed('staff', 'meta', 'seq', { id: 'seq', value: 1 }, { id: 'seq', value: 2 })).toBe(true);
    expect(allowed('staff', 'customers', 'c', null, { id: 'c', name: 'Mia' })).toBe(true);
  });

  it('keeps voids, walk-outs and removing sent dishes for managers', () => {
    expect(allowed('staff', 'orders', 'o', sent, { ...sent, status: 'void' })).toBe(false);
    expect(allowed('staff', 'orders', 'o', sent, { ...sent, status: 'walkout' })).toBe(false);
    expect(allowed('staff', 'orders', 'o', sent, { ...sent, lines: [line('l', 1, 1)] })).toBe(false);
    expect(allowed('staff', 'orders', 'o', sent, { ...sent, lines: [] })).toBe(false);
    expect(allowed('staff', 'orders', 'o', sent, null)).toBe(false);
    expect(allowed('manager', 'orders', 'o', sent, { ...sent, status: 'void' })).toBe(true);
    const voided = { ...sent, status: 'void' };
    expect(allowed('staff', 'orders', 'o', voided, { ...voided, status: 'open' })).toBe(false);
  });

  it('lets staff change an item’s stock but nothing else on the menu or in settings', () => {
    const item = { id: 'i', name: 'Tea', price: 300, active: true, stock: 5 };
    expect(allowed('staff', 'items', 'i', item, { ...item, stock: 4 })).toBe(true);
    expect(allowed('staff', 'items', 'i', item, { ...item, price: 1 })).toBe(false);
    expect(allowed('staff', 'items', 'i', item, null)).toBe(false);
    expect(allowed('staff', 'settings', 'settings', {}, { name: 'X' })).toBe(false);
    expect(allowed('staff', 'tables', 't', null, { id: 't', name: '9' })).toBe(false);
    expect(allowed('staff', 'meta', 'order', null, { id: 'order', items: [] })).toBe(false);
    expect(allowed('staff', 'customers', 'c', { id: 'c' }, null)).toBe(false);
  });

  it('never accepts staff records or edits to the activity log from a device', () => {
    expect(allowed('manager', 'staff', 's', null, { id: 's', name: 'Eve', role: 'manager' })).toBe(false);
    const entry = { id: 'e', at: 1, type: 'void', text: 'Voided #1' };
    expect(allowed('staff', 'log', 'e', null, entry)).toBe(true);
    expect(allowed('manager', 'log', 'e', entry, { ...entry, text: 'nothing happened' })).toBe(false);
    expect(allowed('manager', 'log', 'e', entry, null)).toBe(false);
    expect(allowed('manager', 'log', 'e', entry, null, { logCount: 500 })).toBe(true);
  });
});

describe('syncing changes', () => {
  let store;
  beforeEach(() => {
    store = new Store();
  });
  afterEach(() => store.close());

  it('saves changes under rising revision numbers and reports what a device has not seen', () => {
    const first = push(store, 'open', [
      change('orders', order('a', 1)),
      change('items', { id: 'i', name: 'Tea' }),
    ]);
    expect(first.rejected).toEqual([]);
    expect(first.changes.map((c) => `${c.collection}/${c.id}`)).toEqual(['orders/a', 'meta/seq', 'items/i']);
    const second = push(store, 'open', [change('items', null, first.rev, 'i')], first.rev);
    expect(second.changes).toEqual([{ collection: 'items', id: 'i', rev: second.rev, doc: null }]);
    expect(store.all('items')).toEqual([]);
  });

  it('does not let a device overwrite a change it has not seen', () => {
    const a = push(store, 'open', [change('orders', order('a', 1))]);
    const seen = a.changes.find((c) => c.id === 'a').rev;
    push(store, 'open', [change('orders', order('a', 1, { note: 'from tablet 1' }), seen)]);
    const late = push(
      store,
      'open',
      [change('orders', order('a', 1, { note: 'from tablet 2' }), seen)],
      a.rev,
    );
    expect(late.rejected).toEqual([{ collection: 'orders', id: 'a', reason: 'Changed on another device' }]);
    expect(store.get('orders', 'a').doc.note).toBe('from tablet 1');
    expect(late.changes.find((c) => c.id === 'a').doc.note).toBe('from tablet 1');
  });

  it('gives two bills opened at the same moment different numbers', () => {
    push(store, 'open', [change('orders', order('a', 5))]);
    const b = push(store, 'open', [change('orders', order('b', 5))]);
    expect(store.get('orders', 'b').doc.no).toBe(6);
    expect(b.changes.find((c) => c.id === 'b').doc.no).toBe(6);
    expect(store.get('meta', 'seq').doc.value).toBe(7);
  });

  it('sends back the server’s copy of anything it refuses', () => {
    const made = push(store, 'manager', [change('settings', { id: 'settings', name: 'Bistro' })]);
    const tried = push(
      store,
      'staff',
      [change('settings', { id: 'settings', name: 'Hacked' }, made.rev)],
      made.rev,
    );
    expect(tried.rejected[0].reason).toBe('Needs a manager');
    expect(tried.changes).toEqual([
      { collection: 'settings', id: 'settings', rev: made.rev, doc: { id: 'settings', name: 'Bistro' } },
    ]);
  });

  it('shows the data as ordinary tables for SQLite tools', () => {
    push(store, 'open', [
      change(
        'orders',
        order('a', 1, {
          tableName: '4',
          paidAt: 86400000,
          paidAmount: 1250,
          lines: [line('l', 2)],
          payments: [{ at: 86400000, amount: 600, method: 'Cash' }],
        }),
      ),
    ]);
    expect(store.db.prepare('SELECT number, table_name, paid_amount, paid_at FROM orders').all()).toEqual([
      expect.objectContaining({
        number: 1,
        table_name: '4',
        paid_amount: 12.5,
        paid_at: '1970-01-02 00:00:00',
      }),
    ]);
    expect(store.db.prepare('SELECT name, qty, price FROM order_lines').get()).toMatchObject({
      name: 'Tea',
      qty: 2,
      price: 3,
    });
    expect(store.db.prepare('SELECT amount, method FROM payments').get()).toMatchObject({
      amount: 6,
      method: 'Cash',
    });
  });
});

describe('the server over HTTP', () => {
  let store;
  let server;
  let base;

  /** A pretend device: remembers its cookie like a browser does. */
  function device() {
    let cookie = '';
    return async (method, path, body, headers = { 'X-Mini-POS': '1' }) => {
      const res = await fetch(base + path, {
        method,
        headers: { ...(method === 'GET' ? {} : headers), 'Content-Type': 'application/json', Cookie: cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      return { status: res.status, body: await res.json(), cookie: set };
    };
  }

  beforeEach(async () => {
    store = new Store();
    server = createServer(createApp({ store }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });

  it('needs the owner password to connect a device', async () => {
    const till = device();
    expect((await till('GET', '/api/status')).body).toMatchObject({
      app: 'mini-pos',
      setUp: false,
      connected: false,
    });
    expect((await till('POST', '/api/setup', { password: 'short' })).status).toBe(400);
    const setup = await till('POST', '/api/setup', { password: 'long enough password', device: 'Till' });
    expect(setup.status).toBe(200);
    expect(setup.cookie).toMatch(/HttpOnly; SameSite=Strict/);
    expect((await till('GET', '/api/status')).body).toMatchObject({
      setUp: true,
      connected: true,
      device: 'Till',
    });
    expect((await till('POST', '/api/setup', { password: 'another password!' })).status).toBe(409);

    const stranger = device();
    expect((await stranger('GET', '/api/sync?since=0')).status).toBe(401);
    expect((await stranger('POST', '/api/sync', { changes: [] })).status).toBe(401);
    expect((await stranger('POST', '/api/device', { password: 'guess' })).status).toBe(403);
    expect(
      (await stranger('POST', '/api/device', { password: 'long enough password', device: 'Kitchen' })).status,
    ).toBe(200);
    expect((await stranger('GET', '/api/sync?since=0')).status).toBe(200);
  });

  it('locks out password guessing', async () => {
    const till = device();
    await till('POST', '/api/setup', { password: 'long enough password' });
    const stranger = device();
    for (let i = 0; i < 5; i++) await stranger('POST', '/api/device', { password: `guess ${i}` });
    const locked = await stranger('POST', '/api/device', { password: 'long enough password' });
    expect(locked.status).toBe(429);
  });

  it('refuses changes that do not come from the app', async () => {
    const till = device();
    await till('POST', '/api/setup', { password: 'long enough password' });
    expect((await till('POST', '/api/sync', { changes: [] }, {})).status).toBe(403);
    expect(
      (await till('POST', '/api/sync', { changes: [] }, { 'X-Mini-POS': '1', Origin: 'http://evil.example' }))
        .status,
    ).toBe(403);
  });

  it('checks staff PINs on the server and enforces roles', async () => {
    const till = device();
    await till('POST', '/api/setup', { password: 'long enough password' });
    const sent = order('o', 1, { lines: [line('l', 1, 1)], dishes: [{ id: 'd' }] });
    await till('POST', '/api/sync', { changes: [change('orders', sent)] });

    const ana = (await till('POST', '/api/staff', { name: 'Ana', pin: '1234', role: 'staff' })).body;
    expect(ana).toMatchObject({ signedIn: true, member: { name: 'Ana', role: 'manager' } });
    const ben = (await till('POST', '/api/staff', { name: 'Ben', pin: '5678' })).body.member;
    expect((await till('POST', '/api/staff', { name: 'ben', pin: '0000' })).status).toBe(400);
    expect((await till('POST', '/api/staff', { name: 'Cy', pin: '12' })).status).toBe(400);
    expect((await till('PATCH', `/api/staff/${ana.member.id}`, { role: 'staff' })).status).toBe(400);

    // PIN hashes never leave the server.
    const all = (await till('GET', '/api/sync?since=0')).body;
    expect(JSON.stringify(all)).not.toMatch(/pin|scrypt/i);
    expect(all.changes.filter((c) => c.collection === 'staff').map((c) => c.doc.name)).toEqual([
      'Ana',
      'Ben',
    ]);

    // Locked: nobody signed in on this device.
    await till('POST', '/api/sign-out');
    const rev = () => store.get('orders', 'o').rev;
    const locked = await till('POST', '/api/sync', {
      since: 0,
      changes: [change('orders', { ...sent, note: 'x' }, rev())],
    });
    expect(locked.body.rejected[0].reason).toBe('Sign in first');

    // Staff: wrong PIN, then right; may not void without a manager.
    expect((await till('POST', '/api/sign-in', { staffId: ben.id, pin: '0000' })).status).toBe(403);
    expect((await till('POST', '/api/sign-in', { staffId: ben.id, pin: '5678' })).status).toBe(200);
    expect((await till('GET', '/api/status')).body.staffId).toBe(ben.id);
    const voided = { ...sent, status: 'void', voidedAt: 9 };
    const refused = await till('POST', '/api/sync', { changes: [change('orders', voided, rev())] });
    expect(refused.body.rejected[0].reason).toBe('Needs a manager');
    expect((await till('POST', '/api/staff', { name: 'Eve', pin: '1111', role: 'manager' })).status).toBe(
      403,
    );

    // A manager's PIN approves the next change only; a staff PIN does not.
    expect((await till('POST', '/api/approve', { pin: '5678' })).status).toBe(403);
    const { approval } = (await till('POST', '/api/approve', { pin: '1234' })).body;
    const ok = await till('POST', '/api/sync', { approval, changes: [change('orders', voided, rev())] });
    expect(ok.body.rejected).toEqual([]);
    expect(store.get('orders', 'o').doc.status).toBe('void');
    const again = await till('POST', '/api/sync', {
      approval,
      changes: [change('settings', { id: 'settings', name: 'X' })],
    });
    expect(again.body.rejected[0].reason).toBe('Needs a manager');
  });

  it('locks a device after five wrong PINs', async () => {
    const till = device();
    await till('POST', '/api/setup', { password: 'long enough password' });
    const ana = (await till('POST', '/api/staff', { name: 'Ana', pin: '1234' })).body.member;
    for (let i = 0; i < 5; i++) await till('POST', '/api/sign-in', { staffId: ana.id, pin: '0000' });
    expect((await till('POST', '/api/sign-in', { staffId: ana.id, pin: '1234' })).status).toBe(429);
  });

  it('turns staff sign-in off only with the owner password', async () => {
    const till = device();
    await till('POST', '/api/setup', { password: 'long enough password' });
    await till('POST', '/api/staff', { name: 'Ana', pin: '1234' });
    expect((await till('POST', '/api/staff/reset', { password: 'wrong password' })).status).toBe(403);
    expect((await till('POST', '/api/staff/reset', { password: 'long enough password' })).status).toBe(200);
    expect(store.all('staff')).toEqual([]);
    expect(store.all('log')[0].text).toMatch(/reset with the owner password/);
  });

  it('disconnects other devices when the owner password changes', async () => {
    const till = device();
    const kitchen = device();
    await till('POST', '/api/setup', { password: 'long enough password' });
    await kitchen('POST', '/api/device', { password: 'long enough password' });
    expect(
      (await till('POST', '/api/password', { current: 'nope', next: 'a brand new password' })).status,
    ).toBe(403);
    expect(
      (await till('POST', '/api/password', { current: 'long enough password', next: 'a brand new password' }))
        .status,
    ).toBe(200);
    expect((await kitchen('GET', '/api/sync?since=0')).status).toBe(401);
    expect((await till('GET', '/api/sync?since=0')).status).toBe(200);
    expect((await kitchen('POST', '/api/device', { password: 'a brand new password' })).status).toBe(200);
  });
});
