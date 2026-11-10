/**
 * Applying a device's changes. Each change says which version of the record the device last saw
 * (`baseRev`). If the server's copy is newer, another device got there first: the change is
 * dropped and the device is sent the server's copy instead, so nothing is overwritten unseen.
 */
import { checkChange } from './rules.js';

const COLLECTIONS = new Set([
  'settings',
  'meta',
  'categories',
  'items',
  'tables',
  'orders',
  'customers',
  'drawer',
  'log',
  'staff',
]);

const key = (collection, id) => `${collection}/${id}`;

/** Bill numbers must be unique even when two devices open a bill at the same moment. */
function uniqueOrderNumber(store, order) {
  const numbers = new Set(store.all('orders').map((o) => o.no));
  if (!numbers.has(order.no)) return order;
  return { ...order, no: Math.max(0, ...numbers) + 1 };
}

/** Keep "next order number" ahead of every bill. */
function bumpSequence(store, orderNo) {
  const seq = store.get('meta', 'seq');
  if (!seq?.doc || seq.doc.value <= orderNo) store.put('meta', 'seq', { id: 'seq', value: orderNo + 1 });
}

/**
 * `who` is the session ('open' | 'manager' | 'staff' | 'none').
 * Returns { rev, changes, rejected }: `changes` is everything the device has not seen yet (its own
 * accepted changes included, with their new revision), plus the server's copy of anything refused.
 */
export function applyChanges(store, who, { since = 0, changes = [] }) {
  const rejected = [];
  const corrections = new Map();
  store.transaction(() => {
    for (const change of changes) {
      const { collection, id } = change;
      if (!COLLECTIONS.has(collection) || typeof id !== 'string' || !id) continue;
      const current = store.get(collection, id);
      const before = current?.doc ?? null;
      let after = change.doc ?? null;
      const refuse = (reason) => {
        rejected.push({ collection, id, reason });
        corrections.set(key(collection, id), {
          collection,
          id,
          rev: current?.rev ?? 0,
          doc: before,
        });
      };

      if (current && current.rev > (Number(change.baseRev) || 0)) {
        refuse('Changed on another device');
        continue;
      }
      if (!before && !after) continue;
      const reason = checkChange(who, collection, id, before, after, { logCount: store.count('log') });
      if (reason) {
        refuse(reason);
        continue;
      }
      if (collection === 'orders' && after && !before) after = uniqueOrderNumber(store, after);
      store.put(collection, id, after);
      if (collection === 'orders' && after) bumpSequence(store, after.no);
    }
  });
  const changed = store.changesSince(since);
  const seen = new Set(changed.map((c) => key(c.collection, c.id)));
  for (const [k, correction] of corrections) if (!seen.has(k)) changed.push(correction);
  return { rev: store.rev, changes: changed, rejected };
}
