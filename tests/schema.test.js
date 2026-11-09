import { describe, expect, it } from 'vitest';
import { createSeedData, isBackup, migrate } from '../src/state/schema.js';
import { formatMoney, parseCents } from '../src/utils/money.js';
import { durationStr } from '../src/utils/date.js';

describe('durationStr', () => {
  it('formats order times for people', () => {
    expect(durationStr(20 * 1000)).toBe('<1 min');
    expect(durationStr(12 * 60000)).toBe('12 min');
    expect(durationStr(65 * 60000)).toBe('1h 05m');
    expect(durationStr(null)).toBe('—');
  });
});

describe('schema', () => {
  it('seeds a sample menu without tax or tickets', () => {
    const d = createSeedData();
    expect(d.items.length).toBeGreaterThan(10);
    expect(d.settings).not.toHaveProperty('taxRate');
    expect(d).not.toHaveProperty('tickets');
    expect(d.tables).toHaveLength(12);
  });

  it('migrates v1 data by dropping the tax setting and filling defaults', () => {
    const d = migrate({ version: 1, settings: { name: 'Cafe', taxRate: 8 }, items: [], categories: [] });
    expect(d.version).toBe(5);
    expect(d.settings.name).toBe('Cafe');
    expect(d.settings).not.toHaveProperty('taxRate');
    expect(d.orders).toEqual([]);
    expect(d.seq).toBe(1);
  });

  it('turns paid orders into completed orders', () => {
    const d = migrate({
      items: [],
      categories: [],
      orders: [
        { id: 'a', status: 'paid', paidAt: 100, lines: [] },
        { id: 'b', status: 'void', paidAt: 200, lines: [] },
        { id: 'c', status: 'open', lines: [] },
      ],
    });
    expect(d.orders.map((o) => [o.status, o.completedAt, 'paidAt' in o])).toEqual([
      ['completed', 100, false],
      ['void', 200, false],
      ['open', undefined, false],
    ]);
  });

  it('turns kitchen tickets into per-dish order times', () => {
    const burger = { id: 'L1', name: 'Burger', price: 1250, qty: 2, sent: 2, note: '' };
    const fries = { id: 'L2', name: 'Fries', price: 450, qty: 1, sent: 1, note: '' };
    const d = migrate({
      items: [],
      categories: [],
      orders: [{ id: 'o1', status: 'open', createdAt: 1000, lines: [burger, fries] }],
      tickets: [
        {
          orderId: 'o1',
          createdAt: 2000,
          done: true,
          doneAt: 5000,
          lines: [{ name: 'Burger', qty: 2, note: '' }],
        },
        { orderId: 'o1', createdAt: 3000, done: false, lines: [{ name: 'Fries', qty: 1, note: '' }] },
      ],
    });
    expect(d).not.toHaveProperty('tickets');
    const dishes = d.orders[0].dishes.map(({ lineId, qty, price, orderedAt, completedAt }) => ({
      lineId,
      qty,
      price,
      orderedAt,
      completedAt,
    }));
    expect(dishes).toEqual([
      { lineId: 'L1', qty: 2, price: 1250, orderedAt: 2000, completedAt: 5000 },
      { lineId: 'L2', qty: 1, price: 450, orderedAt: 3000, completedAt: null },
    ]);
  });

  it('records completed orders whose tickets were pruned as served at completion', () => {
    const d = migrate({
      items: [],
      categories: [],
      orders: [
        {
          id: 'o1',
          status: 'paid',
          createdAt: 1000,
          paidAt: 9000,
          lines: [{ id: 'L1', name: 'Tea', price: 275, qty: 2, sent: 0, note: '' }],
        },
      ],
      tickets: [],
    });
    expect(d.orders[0].dishes).toMatchObject([
      { lineId: 'L1', name: 'Tea', qty: 2, price: 275, orderedAt: 1000, completedAt: 9000 },
    ]);
  });

  it('leaves already-migrated dishes alone', () => {
    const dishes = [{ id: 'x', lineId: 'L1', qty: 1, orderedAt: 1, completedAt: null }];
    const d = migrate({
      items: [],
      categories: [],
      orders: [{ id: 'o', status: 'open', lines: [], dishes }],
    });
    expect(d.orders[0].dishes).toEqual(dishes);
  });

  it('turns the old table count into a list of tables, and order table numbers into ids', () => {
    const d = migrate({
      settings: { name: 'Cafe', tables: 3 },
      items: [],
      categories: [],
      orders: [
        { id: 'a', status: 'open', table: 2, lines: [], dishes: [] },
        { id: 'b', status: 'open', table: null, lines: [], dishes: [] },
      ],
    });
    expect(d.tables).toEqual([
      { id: 't1', name: '1' },
      { id: 't2', name: '2' },
      { id: 't3', name: '3' },
    ]);
    expect(d.settings).not.toHaveProperty('tables');
    expect(d.orders[0]).toMatchObject({ table: 't2', tableName: '2' });
    expect(d.orders[1].table).toBeNull();
  });

  it('gives data with no table setting the default 12 tables', () => {
    expect(migrate({ items: [], categories: [] }).tables).toHaveLength(12);
  });

  it('keeps an existing table list', () => {
    const tables = [{ id: 'x', name: 'Patio' }];
    expect(migrate({ items: [], categories: [], tables }).tables).toEqual(tables);
  });

  it('recognises backups', () => {
    expect(isBackup(createSeedData())).toBe(true);
    expect(isBackup({ foo: 1 })).toBe(false);
  });
});

describe('money', () => {
  it('formats cents', () => {
    expect(formatMoney(123456, '$', 'en-US')).toBe('$1,234.56');
    expect(formatMoney(-360, '$', 'en-US')).toBe('-$3.60');
  });
  it('parses input to cents', () => {
    expect(parseCents('4.75')).toBe(475);
    expect(parseCents('')).toBe(0);
    expect(parseCents('abc')).toBe(0);
  });
});
