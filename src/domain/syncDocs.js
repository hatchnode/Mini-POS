/**
 * The app's data as separate records for syncing with the server, and back.
 *
 * In the browser everything is one object (`data`). The server keeps one record per order, menu
 * item, customer and so on, so that two devices changing different things never clash. A record
 * is addressed by collection and id ("orders/abc123").
 *
 *   settings/settings     the settings
 *   meta/seq              the next order number
 *   meta/order            the display order of categories, items and tables
 *   categories, items, tables, orders, customers, log   one record each, by id
 *   drawer/<date>         a day's cash drawer figures
 *   staff                 owned by the server: received, never sent
 */
const LISTS = ['categories', 'items', 'tables', 'orders', 'customers', 'log'];
const ORDERED = ['categories', 'items', 'tables'];

export const docKey = (collection, id) => `${collection}/${id}`;

/** A short fingerprint of a record's JSON, to tell whether it changed since it was last synced. */
export function fingerprint(json) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b + c, 0x5bd1e995) ^ (b >>> 13);
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}${json.length.toString(36)}`;
}

/** Every record the device would send, as a Map of key → { collection, id, doc }. */
export function toDocs(data) {
  const docs = new Map();
  const add = (collection, id, doc) => docs.set(docKey(collection, id), { collection, id, doc });
  add('settings', 'settings', { id: 'settings', ...data.settings });
  add('meta', 'seq', { id: 'seq', value: data.seq });
  add('meta', 'order', {
    id: 'order',
    ...Object.fromEntries(ORDERED.map((list) => [list, (data[list] || []).map((x) => x.id)])),
  });
  for (const list of LISTS) for (const doc of data[list] || []) if (doc.id) add(list, doc.id, doc);
  for (const [date, entry] of Object.entries(data.drawer || {})) add('drawer', date, { id: date, ...entry });
  return docs;
}

/**
 * What changed since the last sync. `synced` maps key → [revision, fingerprint] for every record
 * the server and this device agreed on. Returns changes to send, each with the revision it was
 * based on and the JSON that was compared (`json`, null for a deletion).
 */
export function diffDocs(synced, docs) {
  const changes = [];
  for (const [key, { collection, id, doc }] of docs) {
    const json = JSON.stringify(doc);
    const known = synced[key];
    if (!known) changes.push({ collection, id, doc, baseRev: 0, json });
    else if (known[1] !== fingerprint(json)) changes.push({ collection, id, doc, baseRev: known[0], json });
  }
  for (const key of Object.keys(synced)) {
    if (docs.has(key) || key.startsWith('staff/')) continue;
    const [collection, id] = [key.slice(0, key.indexOf('/')), key.slice(key.indexOf('/') + 1)];
    changes.push({ collection, id, doc: null, baseRev: synced[key][0], json: null });
  }
  return changes;
}

function upsert(list, id, doc) {
  const index = list.findIndex((x) => x.id === id);
  if (!doc) {
    if (index >= 0) list.splice(index, 1);
  } else if (index >= 0) list[index] = doc;
  else list.push(doc);
}

/** Put a list in the order given by a list of ids; anything not mentioned keeps its place at the end. */
function arrange(list, ids) {
  const position = new Map(ids.map((id, i) => [id, i]));
  const rank = (x) => (position.has(x.id) ? position.get(x.id) : Infinity);
  return list
    .map((item, i) => [item, i])
    .sort(([a, i], [b, j]) => rank(a) - rank(b) || i - j)
    .map(([item]) => item);
}

/**
 * Apply records received from the server (`[{ collection, id, doc }]`, doc null = deleted) to
 * `data`, in place. `order` is the last known meta/order record, used to keep lists in order
 * when the changes don't include one. Returns the meta/order record now in force.
 */
export function applyDocs(data, rows, order = null) {
  for (const { collection, id, doc } of rows) {
    if (collection === 'settings') {
      if (doc) {
        // eslint-disable-next-line no-unused-vars
        const { id: _, ...settings } = doc;
        data.settings = settings;
      }
    } else if (collection === 'meta') {
      if (id === 'seq' && doc) data.seq = doc.value;
      if (id === 'order' && doc) order = doc;
    } else if (collection === 'drawer') {
      data.drawer = { ...(data.drawer || {}) };
      if (doc) {
        // eslint-disable-next-line no-unused-vars
        const { id: _, ...entry } = doc;
        data.drawer[id] = entry;
      } else delete data.drawer[id];
    } else if (collection === 'staff' || LISTS.includes(collection)) {
      data[collection] = data[collection] || [];
      upsert(data[collection], id, doc);
    }
  }
  if (order) for (const list of ORDERED) data[list] = arrange(data[list] || [], order[list] || []);
  data.orders = [...(data.orders || [])].sort((a, b) => a.no - b.no);
  data.log = [...(data.log || [])].sort((a, b) => a.at - b.at);
  return order;
}

/**
 * The server changed a record this device had just sent (for example, gave a new bill a different
 * number). Copy the fields the server changed onto the local record, keeping local edits made since.
 */
export function mergeAdjusted(local, sent, fromServer) {
  for (const field of new Set([...Object.keys(sent), ...Object.keys(fromServer)])) {
    if (JSON.stringify(sent[field]) === JSON.stringify(fromServer[field])) continue;
    if (field in fromServer) local[field] = fromServer[field];
    else delete local[field];
  }
}
