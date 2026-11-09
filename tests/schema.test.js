import { describe, expect, it } from 'vitest';
import { createSeedData, isBackup, migrate } from '../src/state/schema.js';
import { pruneTickets, ticketUrgency } from '../src/domain/kitchen.js';
import { formatMoney, parseCents } from '../src/utils/money.js';

describe('schema', () => {
  it('seeds a sample menu without tax', () => {
    const d = createSeedData();
    expect(d.items.length).toBeGreaterThan(10);
    expect(d.settings).not.toHaveProperty('taxRate');
  });

  it('migrates v1 data by dropping the tax setting and filling defaults', () => {
    const d = migrate({ version: 1, settings: { name: 'Cafe', taxRate: 8 }, items: [], categories: [] });
    expect(d.version).toBe(3);
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
        { id: 'a', status: 'paid', paidAt: 100 },
        { id: 'b', status: 'void', paidAt: 200 },
        { id: 'c', status: 'open' },
      ],
    });
    expect(d.orders[0]).toEqual({ id: 'a', status: 'completed', completedAt: 100 });
    expect(d.orders[1]).toEqual({ id: 'b', status: 'void', completedAt: 200 });
    expect(d.orders[2]).toEqual({ id: 'c', status: 'open' });
  });

  it('recognises backups', () => {
    expect(isBackup(createSeedData())).toBe(true);
    expect(isBackup({ foo: 1 })).toBe(false);
  });
});

describe('kitchen tickets', () => {
  it('ages from green to amber to red', () => {
    const now = 100 * 60000;
    expect(ticketUrgency({ createdAt: now - 2 * 60000 }, now)).toBe('');
    expect(ticketUrgency({ createdAt: now - 10 * 60000 }, now)).toBe('mid');
    expect(ticketUrgency({ createdAt: now - 20 * 60000 }, now)).toBe('late');
  });

  it('prunes tickets finished more than a day ago', () => {
    const now = 10 * 864e5;
    const data = {
      tickets: [
        { done: true, doneAt: now - 2 * 864e5 },
        { done: true, doneAt: now - 1000 },
        { done: false, createdAt: 0 },
      ],
    };
    pruneTickets(data, now);
    expect(data.tickets).toHaveLength(2);
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
