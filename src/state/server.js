/**
 * Talking to the Mini-POS server, when the app is opened from one.
 *
 * Without a server (the app opened from a plain web host) nothing here runs and the app works on
 * its own, as before. With a server:
 *   - the device must be connected with the owner password before it gets any data;
 *   - staff PINs and manager approvals are checked by the server;
 *   - every change is sent to the server and changes from other devices arrive within a moment.
 *
 * The browser still keeps its own copy, so a device that loses the server keeps working and sends
 * its changes when the server is back. If the same record was changed on another device in the
 * meantime, the server's copy wins and the local change is dropped (the user is told).
 */
import { applyDocs, diffDocs, docKey, fingerprint, mergeAdjusted, toDocs } from '../domain/syncDocs.js';
import { migrate } from './schema.js';
import { writeStoredData } from './storage.js';
import { replaceData, setServerOwnsStaff, store } from './store.js';

const SYNC_KEY = 'mini-pos-sync';
const SEND_DELAY_MS = 250;
const RETRY_MS = 10000;

/**
 * mode: 'local' (no server) or 'server'. phase: 'setup' (server has no owner password yet),
 * 'connect' (this device isn't connected), 'ready'. online: is the server reachable right now.
 */
export const server = {
  mode: 'local',
  phase: 'ready',
  online: false,
  device: '',
  pending: 0,
  lastSyncAt: null,
};

/** serverId, rev: the last revision seen; synced: key → [rev, fingerprint]; order: last meta/order; staffId. */
let sync = { serverId: null, rev: 0, synced: {}, order: null, staffId: null };
let approval = null;
let timer = null;
let chain = Promise.resolve();
let listeners = { change: () => {}, applied: () => {}, rejected: () => {} };

/** change: status changed; applied(count): records from other devices arrived; rejected(list): changes refused. */
export const onServerEvent = (handlers) => {
  listeners = { ...listeners, ...handlers };
};

function loadSyncState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_KEY));
    if (saved?.serverId) sync = { ...sync, ...saved };
  } catch {
    /* no saved state */
  }
}

function saveSyncState() {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
  } catch {
    /* storage full or blocked: syncing still works until the page reloads */
  }
}

/** Call the server. Returns { ok, status, body }; status 0 means it could not be reached. */
async function api(method, path, body, timeoutMs = 15000) {
  try {
    const res = await fetch(path, {
      method,
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Mini-POS': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, body: data };
  } catch {
    return { ok: false, status: 0, body: { error: 'The server cannot be reached right now' } };
  }
}

function setOnline(online) {
  if (server.online !== online) {
    server.online = online;
    listeners.change();
  }
}

/** The answer to a failed call, in the user's terms. */
const failure = (res) => ({ ok: false, error: res.body?.error || 'The server cannot be reached right now' });

function applyStatus(status) {
  server.mode = 'server';
  server.online = true;
  server.device = status.device || '';
  server.phase = !status.setUp ? 'setup' : status.connected ? 'ready' : 'connect';
  setServerOwnsStaff(true);
  if (status.connected) {
    store.ui.staffId = status.staffId;
    sync.staffId = status.staffId;
  }
}

/** On start-up: is this app being served by a Mini-POS server? */
export async function detectServer() {
  loadSyncState();
  const res = await api('GET', '/api/status', undefined, 4000);
  if (res.ok && res.body?.app === 'mini-pos') {
    applyStatus(res.body);
    if (server.phase === 'ready') await startSync(res.body.serverId);
  } else if (res.status === 0 && sync.serverId) {
    // Used a server before but it can't be reached: carry on with the local copy.
    server.mode = 'server';
    server.phase = 'ready';
    server.online = false;
    setServerOwnsStaff(true);
    store.ui.staffId = sync.staffId;
    startTimers();
  }
  listeners.change();
}

/** First run of a new server: choose the owner password. Connects this device too. */
export async function setupServer(password, device) {
  const res = await api('POST', '/api/setup', { password, device });
  return res.ok ? afterConnect() : failure(res);
}

export async function connectDevice(password, device) {
  const res = await api('POST', '/api/device', { password, device });
  return res.ok ? afterConnect() : failure(res);
}

async function afterConnect() {
  const res = await api('GET', '/api/status');
  if (!res.ok) return failure(res);
  applyStatus(res.body);
  const started = await startSync(res.body.serverId);
  listeners.change();
  return { ok: true, ...started };
}

export async function disconnectDevice() {
  await api('DELETE', '/api/device');
  sync = { serverId: null, rev: 0, synced: {}, order: null, staffId: null };
  saveSyncState();
  server.phase = 'connect';
  store.ui.staffId = null;
  listeners.change();
}

export async function changeOwnerPassword(current, next) {
  const res = await api('POST', '/api/password', { current, next });
  return res.ok ? { ok: true } : failure(res);
}

/* ---------- staff ---------- */

export async function signIn(staffId, pin) {
  const res = await api('POST', '/api/sign-in', { staffId, pin });
  if (!res.ok) return failure(res);
  sync.staffId = staffId;
  saveSyncState();
  return { ok: true };
}

export function signOut() {
  sync.staffId = null;
  saveSyncState();
  return api('POST', '/api/sign-out', {});
}

/** A manager's PIN approves the next change this device sends. Returns { ok, manager } or { ok: false, error }. */
export async function approve(pin) {
  const res = await api('POST', '/api/approve', { pin });
  if (!res.ok) return failure(res);
  approval = res.body.approval;
  return { ok: true, manager: res.body.manager };
}

async function staffCall(method, path, body) {
  const res = await api(method, path, body);
  if (!res.ok) return failure(res);
  if (res.body.signedIn) {
    store.ui.staffId = res.body.member.id;
    sync.staffId = res.body.member.id;
  }
  await syncSoon();
  return { ok: true, ...res.body };
}

export const staffApi = {
  add: (member) => staffCall('POST', '/api/staff', member),
  setRole: (id, role) => staffCall('PATCH', `/api/staff/${id}`, { role }),
  setPin: (id, pin) => staffCall('PATCH', `/api/staff/${id}`, { pin }),
  remove: (id) => staffCall('DELETE', `/api/staff/${id}`),
  /** Lost manager PIN: the owner password removes all staff and turns sign-in off. */
  reset: (password) => staffCall('POST', '/api/staff/reset', { password }),
};

/* ---------- syncing ---------- */

function startTimers() {
  if (startTimers.started) return;
  startTimers.started = true;
  // The server says when something changed, so other devices' changes show up at once.
  const events = new EventSource('/api/events');
  events.onmessage = () => {
    setOnline(true);
    scheduleSync(0);
  };
  events.onerror = () => setOnline(false);
  // Also try regularly: sends anything waiting once the server is back.
  setInterval(() => scheduleSync(0), RETRY_MS);
}

/**
 * Begin syncing with this server. The first time a device meets a server, either the server is
 * empty and takes this device's data, or it has data and that replaces what is on the device
 * (returned as `replaced`, with the device's old data, so the caller can offer it as a backup).
 */
async function startSync(serverId) {
  let result = {};
  if (sync.serverId !== serverId) {
    const all = await api('GET', '/api/sync?since=0');
    if (!all.ok) return {};
    sync = { serverId, rev: 0, synced: {}, order: null, staffId: sync.staffId };
    const hasData = all.body.changes.some((c) => c.doc && c.collection !== 'staff' && c.collection !== 'log');
    if (hasData) {
      const previous = store.data;
      const fresh = migrate({ settings: {}, categories: [], items: [], tables: [], orders: [] });
      replaceData(fresh);
      store.data.staff = [];
      result = { replaced: previous.orders.length ? previous : null };
    } else {
      // The server is new: it takes this device's data. Staff are added again on the server,
      // because it keeps its own, properly protected PINs.
      result = { droppedStaff: store.data.staff.length };
      store.data.staff = [];
    }
    receive(all.body, new Map());
  }
  startTimers();
  await syncSoon();
  return result;
}

/** Take in an answer from the server. `sent` maps key → the JSON this device just sent for it. */
function receive(body, sent) {
  const refused = new Set((body.rejected || []).map((r) => docKey(r.collection, r.id)));
  const incoming = [];
  for (const row of body.changes) {
    const key = docKey(row.collection, row.id);
    const json = row.doc === null ? null : JSON.stringify(row.doc);
    const mine = sent.has(key) && !refused.has(key);
    if (mine && json !== sent.get(key) && json !== null && sent.get(key) !== null) {
      // Accepted, but the server adjusted it (e.g. a new bill's number): fold that in.
      const local = toDocs(store.data).get(key)?.doc;
      if (local) mergeAdjusted(local, JSON.parse(sent.get(key)), row.doc);
      if (row.collection === 'meta' || row.collection === 'settings' || row.collection === 'drawer')
        incoming.push(row);
    } else if (!mine) incoming.push(row);
    if (json === null) delete sync.synced[key];
    else sync.synced[key] = [row.rev, fingerprint(mine && json === sent.get(key) ? sent.get(key) : json)];
  }
  if (incoming.length) sync.order = applyDocs(store.data, incoming, sync.order);
  sync.rev = Math.max(sync.rev, body.rev);
  if (store.ui.staffId && !store.data.staff.some((s) => s.id === store.ui.staffId)) store.ui.staffId = null;
  saveSyncState();
  writeStoredData(store.data);
  if (body.rejected?.length) listeners.rejected(body.rejected);
  if (incoming.length) listeners.applied(incoming.length);
}

async function syncNow() {
  if (server.mode !== 'server' || server.phase !== 'ready') return;
  const changes = diffDocs(sync.synced, toDocs(store.data));
  server.pending = changes.length;
  const sent = new Map(changes.map((c) => [docKey(c.collection, c.id), c.json]));
  const res = changes.length
    ? await api('POST', '/api/sync', {
        since: sync.rev,
        approval: approval || undefined,
        changes: changes.map(({ collection, id, doc, baseRev }) => ({ collection, id, doc, baseRev })),
      })
    : await api('GET', `/api/sync?since=${sync.rev}`);
  if (changes.length) approval = null;
  if (res.status === 401) {
    // No longer connected (e.g. the owner password was changed): ask for it again.
    server.phase = 'connect';
    return listeners.change();
  }
  if (!res.ok) return setOnline(false);
  server.online = true;
  receive(res.body, sent);
  server.pending = diffDocs(sync.synced, toDocs(store.data)).length;
  server.lastSyncAt = Date.now();
  listeners.change();
  if (server.pending) scheduleSync(SEND_DELAY_MS); // edits made while this was in flight
}

/** Sync shortly (a burst of taps becomes one request). Requests never overlap. */
export function scheduleSync(delay = SEND_DELAY_MS) {
  if (server.mode !== 'server' || server.phase !== 'ready') return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    chain = chain.then(syncNow).catch(() => {});
  }, delay);
}

/** Sync now and wait for it (used right after a manager approval, so the approval covers the right change). */
export function syncSoon() {
  clearTimeout(timer);
  chain = chain.then(syncNow).catch(() => {});
  return chain;
}
