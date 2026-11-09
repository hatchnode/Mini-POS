import { describe, expect, it } from 'vitest';
import { chartHours, completedDishes, dishCsvRows, summarizeSales } from '../src/domain/sales.js';

const at = (h, m = 0) => new Date(2026, 10, 9, h, m).getTime();
const day = [new Date(2026, 10, 9).getTime(), new Date(2026, 10, 10).getTime()];

const dish = (name, price, qty, orderedAt, completedAt, note = '') => ({
  id: `${name}-${orderedAt}`,
  lineId: name,
  name,
  price,
  qty,
  note,
  orderedAt,
  completedAt,
});
const line = (name, price, qty) => ({ id: name, name, price, qty, sent: qty, note: '' });

const orders = [
  {
    // paid and completed at 12:30
    id: 'A',
    no: 1,
    table: 't1',
    tableName: '1',
    status: 'completed',
    createdAt: at(12, 0),
    paidAt: at(12, 30),
    paidAmount: 2500,
    completedAt: at(12, 30),
    lines: [line('Burger', 1250, 2)],
    totals: { subtotal: 2500, total: 2500 },
    dishes: [dish('Burger', 1250, 2, at(12, 0), at(12, 20), 'No onions')],
  },
  {
    // still open: served, NOT paid
    id: 'B',
    no: 2,
    table: 't2',
    tableName: '2',
    status: 'open',
    createdAt: at(13, 0),
    lines: [line('Coffee', 300, 1)],
    dishes: [dish('Coffee', 300, 1, at(13, 0), at(13, 10))],
  },
  {
    // customer left without paying
    id: 'C',
    no: 3,
    table: 't3',
    tableName: '3',
    status: 'walkout',
    createdAt: at(14, 0),
    completedAt: at(14, 40),
    lines: [line('Tea', 275, 2)],
    totals: { subtotal: 550, total: 550 },
    dishes: [dish('Tea', 275, 2, at(14, 0), at(14, 5))],
  },
  {
    // voided
    id: 'D',
    no: 4,
    table: null,
    status: 'void',
    createdAt: at(15, 0),
    voidedAt: at(15, 5),
    lines: [line('Soda', 250, 1)],
    dishes: [dish('Soda', 250, 1, at(15, 0), at(15, 2))],
  },
  {
    // paid yesterday
    id: 'E',
    no: 5,
    table: 't1',
    tableName: '1',
    status: 'completed',
    createdAt: at(9) - 864e5,
    paidAt: at(9) - 864e5,
    paidAmount: 999,
    completedAt: at(9) - 864e5,
    lines: [line('Tea', 999, 1)],
    totals: { subtotal: 999, total: 999 },
    dishes: [dish('Tea', 999, 1, at(9) - 864e5, at(9) - 864e5)],
  },
];

describe('summarizeSales', () => {
  const s = summarizeSales(orders, day);

  it('counts money only for bills paid that day', () => {
    expect(s.total).toBe(2500);
    expect(s.paidCount).toBe(1);
    expect(s.average).toBe(2500);
    expect(s.byHour).toEqual({ 12: 2500 });
    expect(s.topItems).toEqual([{ name: 'Burger', qty: 2, revenue: 2500 }]);
  });

  it('reports walk-outs separately as a loss', () => {
    expect(s.walkoutCount).toBe(1);
    expect(s.walkoutTotal).toBe(550);
  });

  it('lists paid, walked-out and void bills, newest first, but not unpaid open ones', () => {
    expect(s.bills.map((o) => o.no)).toEqual([4, 3, 1]);
  });

  it('times every dish the kitchen completed, except on voided orders', () => {
    expect(s.dishCount).toBe(3);
    expect(s.itemsSold).toBe(5);
    expect(s.averageDishTime).toBe(Math.round(((20 + 10 + 5) / 3) * 60000));
    expect(summarizeSales([], day).averageDishTime).toBeNull();
  });
});

describe('completedDishes', () => {
  it('tags each dish with its bill status', () => {
    expect(completedDishes(orders, day).map((d) => [d.name, d.bill])).toEqual([
      ['Tea', 'walkout'],
      ['Coffee', 'served-unpaid'],
      ['Burger', 'paid'],
    ]);
  });
});

describe('chartHours', () => {
  it('pads a short range to at least 8 hours', () => {
    expect(chartHours({ 12: 100 })).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
  });
  it('is empty with no sales', () => {
    expect(chartHours({})).toEqual([]);
  });
});

describe('dishCsvRows', () => {
  it('logs each dish with its times, amount and bill status', () => {
    const [header, ...rows] = dishCsvRows(completedDishes(orders, day));
    expect(header).toEqual([
      'Order',
      'Table',
      'Dish',
      'Qty',
      'Note',
      'Ordered at',
      'Completed at',
      'Minutes',
      'Amount',
      'Bill',
    ]);
    expect(rows[0]).toEqual([
      1,
      'Table 1',
      'Burger',
      2,
      'No onions',
      new Date(at(12, 0)).toLocaleString(),
      new Date(at(12, 20)).toLocaleString(),
      20,
      '25.00',
      'Paid',
    ]);
    expect(rows.map((r) => r[9])).toEqual(['Paid', 'Served · unpaid', 'Walked out']);
  });
});
