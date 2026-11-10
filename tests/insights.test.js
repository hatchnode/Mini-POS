import { describe, expect, it } from 'vitest';
import { periodDates, popularItemIds, summarizeTrends } from '../src/domain/insights.js';
import { drawerSummary, setDrawer } from '../src/domain/drawer.js';

const at = (date, hour = 12) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();
const NOW = at('2026-03-10', 20);

const bill = (date, hour, lines, extra = {}) => {
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  return {
    id: `${date}-${hour}-${Math.random()}`,
    no: 1,
    status: 'completed',
    createdAt: at(date, hour),
    completedAt: at(date, hour),
    paidAt: at(date, hour),
    paidAmount: total,
    totals: { subtotal: total, total },
    lines,
    dishes: [],
    ...extra,
  };
};
const line = (itemId, name, price, qty = 1) => ({ itemId, name, price, qty, sent: qty });

const data = () => ({
  items: [
    { id: 'b', name: 'Burger', price: 1000, active: true },
    { id: 'f', name: 'Fries', price: 400, active: true },
    { id: 's', name: 'Soup', price: 600, active: true },
    { id: 'old', name: 'Old Special', price: 900, active: false },
  ],
  orders: [
    bill('2026-03-10', 12, [line('b', 'Burger', 1000, 2)]),
    bill('2026-03-09', 19, [line('b', 'Burger', 1000), line('f', 'Fries', 400)]),
    bill('2026-03-04', 19, [line('f', 'Fries', 400)]),
    bill('2026-03-03', 13, [line('b', 'Burger', 1000)]), // previous week
    bill('2026-03-08', 13, [line('s', 'Soup', 600, 5)], { status: 'void', voidedAt: at('2026-03-08', 14) }),
  ],
});

describe('summarizeTrends', () => {
  it('covers the last N days ending today', () => {
    expect(periodDates(7, NOW)).toEqual([
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
  });

  it('totals the period, compares it with the one before and finds the best day', () => {
    const t = summarizeTrends(data(), 7, NOW);
    expect(t.current.total).toBe(3800);
    expect(t.previousTotal).toBe(1000);
    expect(t.change).toBeCloseTo(2.8);
    expect(t.byDay.map((d) => d.total)).toEqual([400, 0, 0, 0, 0, 1400, 2000]);
    expect(t.bestDay.date).toBe('2026-03-10');
    expect(t.busiestHour).toBe(12);
  });

  it('lists menu items nobody bought', () => {
    expect(summarizeTrends(data(), 7, NOW).notSelling.map((i) => i.name)).toEqual(['Soup']);
  });

  it('has nothing to compare against on a first week', () => {
    const d = data();
    d.orders = d.orders.slice(0, 1);
    expect(summarizeTrends(d, 7, NOW).change).toBe(null);
  });
});

describe('popularItemIds', () => {
  it('ranks items still on the menu by how many were ordered, skipping voids', () => {
    expect(popularItemIds(data(), NOW)).toEqual(['b', 'f']);
    expect(popularItemIds(data(), NOW, 30, 1)).toEqual(['b']);
  });
});

describe('cash drawer', () => {
  it('works out what should be in the drawer and the difference once counted', () => {
    const d = { drawer: {} };
    expect(drawerSummary(d.drawer['2026-03-10'], 5000)).toEqual({
      float: 0,
      cashSales: 5000,
      expected: 5000,
      counted: null,
      difference: null,
    });
    setDrawer(d, '2026-03-10', { float: 10000 });
    setDrawer(d, '2026-03-10', { counted: 14800 });
    expect(drawerSummary(d.drawer['2026-03-10'], 5000)).toMatchObject({ expected: 15000, difference: -200 });
  });
});
