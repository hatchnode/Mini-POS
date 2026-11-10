import { describe, expect, it } from 'vitest';
import { applyDocs, diffDocs, docKey, fingerprint, mergeAdjusted, toDocs } from '../src/domain/syncDocs.js';
import { addItem, createOrder } from '../src/domain/orders.js';
import { setDrawer } from '../src/domain/drawer.js';
import { logEvent } from '../src/domain/log.js';
import { createSeedData, migrate } from '../src/state/schema.js';

/** Pretend everything in `docs` was just agreed with the server at revision 1. */
const agreed = (docs) =>
  Object.fromEntries([...docs].map(([key, { doc }]) => [key, [1, fingerprint(JSON.stringify(doc))]]));
const rows = (docs) =>
  [...docs.values()].map(({ collection, id, doc }) => ({ collection, id, doc: structuredClone(doc) }));
const empty = () => migrate({ settings: {}, categories: [], items: [], tables: [], orders: [] });

function sample() {
  const data = createSeedData();
  const order = createOrder(data, data.tables[0], 1000);
  addItem(order, data.items[0]);
  setDrawer(data, '2026-03-10', { float: 5000 });
  logEvent(data, 'void', 'Voided #9', 'Ana', 2000);
  return data;
}

describe('records for syncing', () => {
  it('splits the data into one record per thing', () => {
    const docs = toDocs(sample());
    expect(docs.get('settings/settings').doc.name).toBe('My Restaurant');
    expect(docs.get('meta/seq').doc).toEqual({ id: 'seq', value: 2 });
    expect(docs.get('meta/order').doc.tables.slice(0, 2)).toEqual(['t1', 't2']);
    expect(docs.get('drawer/2026-03-10').doc).toEqual({ id: '2026-03-10', float: 5000 });
    expect([...docs.keys()].filter((k) => k.startsWith('orders/'))).toHaveLength(1);
    expect([...docs.keys()].some((k) => k.startsWith('staff/'))).toBe(false);
  });

  it('rebuilds the same data on another device, in the same order', () => {
    const data = sample();
    const other = empty();
    applyDocs(other, rows(toDocs(data)).reverse());
    for (const part of ['settings', 'categories', 'items', 'tables', 'orders', 'seq', 'drawer', 'log']) {
      expect(other[part]).toEqual(data[part]);
    }
    expect(diffDocs(agreed(toDocs(data)), toDocs(other))).toEqual([]);
  });

  it('sends only what changed, with the revision it was based on', () => {
    const data = sample();
    const synced = agreed(toDocs(data));
    expect(diffDocs(synced, toDocs(data))).toEqual([]);

    addItem(data.orders[0], data.items[1]);
    data.items[2].stock = 3;
    data.customers.push({ id: 'c1', name: 'Mia', phone: '', createdAt: 1, redeemed: 0 });
    data.tables.pop();
    const changes = diffDocs(synced, toDocs(data));
    expect(
      changes.map((c) => [docKey(c.collection, c.id).split('/')[0], c.baseRev, c.doc === null]).sort(),
    ).toEqual(
      [
        ['customers', 0, false],
        ['items', 1, false],
        ['meta', 1, false], // the display order lost a table
        ['orders', 1, false],
        ['tables', 1, true],
      ].sort(),
    );
  });

  it('never sends staff records, which belong to the server', () => {
    const data = sample();
    const synced = { ...agreed(toDocs(data)), 'staff/s1': [1, 'x'] };
    data.staff = [];
    expect(diffDocs(synced, toDocs(data))).toEqual([]);
  });

  it('applies deletions and staff from the server', () => {
    const data = sample();
    applyDocs(data, [
      { collection: 'items', id: data.items[0].id, doc: null },
      { collection: 'staff', id: 's1', doc: { id: 's1', name: 'Ana', role: 'manager' } },
      { collection: 'drawer', id: '2026-03-10', doc: null },
      { collection: 'meta', id: 'seq', doc: { id: 'seq', value: 40 } },
    ]);
    expect(data.items[0].name).toBe('Chicken Sandwich');
    expect(data.staff).toEqual([{ id: 's1', name: 'Ana', role: 'manager' }]);
    expect([data.drawer, data.seq]).toEqual([{}, 40]);
  });

  it('folds in a server adjustment without losing edits made since', () => {
    const sent = { id: 'o', no: 5, lines: [1] };
    const local = { id: 'o', no: 5, lines: [1, 2] }; // the user added an item while it was being sent
    mergeAdjusted(local, sent, { id: 'o', no: 6, lines: [1] });
    expect(local).toEqual({ id: 'o', no: 6, lines: [1, 2] });
  });
});
