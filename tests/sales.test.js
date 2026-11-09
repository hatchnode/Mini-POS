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

const orders = [
  {
    id: 'A',
    no: 1,
    table: 1,
    status: 'completed',
    createdAt: at(12, 0),
    completedAt: at(12, 20),
    lines: [{ name: 'Burger', price: 1250, qty: 2 }],
    totals: { subtotal: 2500, total: 2500 },
    dishes: [dish('Burger', 1250, 2, at(12, 0), at(12, 20), 'No onions')],
  },
  {
    // still open: one dish done, one cooking
    id: 'B',
    no: 2,
    table: 2,
    status: 'open',
    createdAt: at(13, 0),
    lines: [],
    dishes: [dish('Coffee', 300, 1, at(13, 0), at(13, 10)), dish('Cheesecake', 650, 1, at(13, 0), null)],
  },
  {
    id: 'C',
    no: 3,
    table: 3,
    status: 'void',
    createdAt: at(14, 0),
    completedAt: at(14, 5),
    lines: [],
    totals: { subtotal: 275, total: 275 },
    dishes: [dish('Tea', 275, 1, at(14, 0), at(14, 5))],
  },
  {
    id: 'D',
    no: 4,
    table: 1,
    status: 'completed',
    createdAt: at(9) - 864e5,
    completedAt: at(9) - 864e5,
    lines: [],
    totals: { subtotal: 999, total: 999 },
    dishes: [dish('Tea', 999, 1, at(9) - 864e5, at(9) - 864e5)], // previous day
  },
];

describe('completedDishes', () => {
  it('lists every dish completed that day, newest first, skipping voided orders', () => {
    const list = completedDishes(orders, day);
    expect(list.map((d) => [d.name, d.orderLabel, d.orderNo])).toEqual([
      ['Coffee', 'Table 2', 2],
      ['Burger', 'Table 1', 1],
    ]);
  });
});

describe('summarizeSales', () => {
  const s = summarizeSales(orders, day);

  it('counts a sale for each completed dish, even on tables still open', () => {
    expect(s.total).toBe(2800);
    expect(s.dishCount).toBe(2);
    expect(s.itemsSold).toBe(3);
  });

  it('averages each dish’s time from order to completion', () => {
    expect(s.averageDishTime).toBe(15 * 60000); // 20 min and 10 min
    expect(summarizeSales([], day).averageDishTime).toBeNull();
  });

  it('lists finished bills and counts tables served', () => {
    expect(s.orders.map((o) => o.no)).toEqual([3, 1]);
    expect(s.tablesServed).toBe(1);
  });

  it('ranks items and groups sales by the hour dishes were completed', () => {
    expect(s.topItems[0]).toEqual({ name: 'Burger', qty: 2, revenue: 2500 });
    expect(s.byHour).toEqual({ 12: 2500, 13: 300 });
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
  it('logs each dish with its order time, completion time and minutes', () => {
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
    ]);
  });
});
