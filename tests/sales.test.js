import { describe, expect, it } from 'vitest';
import { chartHours, salesCsvRows, summarizeSales } from '../src/domain/sales.js';

const at = (h) => new Date(2026, 10, 9, h, 15).getTime();
const day = [new Date(2026, 10, 9).getTime(), new Date(2026, 10, 10).getTime()];

const paid = (no, h, method, lines, totals) => ({
  no,
  table: 1,
  status: 'paid',
  paidAt: at(h),
  lines,
  totals,
  payment: { method },
});

const orders = [
  paid(1, 12, 'cash', [{ name: 'Burger', price: 1250, qty: 2 }], {
    subtotal: 2500,
    discount: 250,
    tip: 300,
    total: 2550,
  }),
  paid(2, 13, 'card', [{ name: 'Coffee', price: 300, qty: 1 }], {
    subtotal: 300,
    discount: 0,
    tip: 0,
    total: 300,
  }),
  {
    ...paid(3, 14, 'cash', [{ name: 'Tea', price: 275, qty: 1 }], {
      subtotal: 275,
      discount: 0,
      tip: 0,
      total: 275,
    }),
    status: 'void',
  },
  { ...paid(4, 9, 'cash', [], { subtotal: 999, discount: 0, tip: 0, total: 999 }), paidAt: at(9) - 864e5 }, // previous day
];

describe('summarizeSales', () => {
  const s = summarizeSales(orders, day);

  it('counts paid orders on the day only', () => {
    expect(s.count).toBe(2);
    expect(s.orders.map((o) => o.no)).toEqual([3, 2, 1]); // voided listed, newest first
  });

  it('totals money', () => {
    expect(s.total).toBe(2850);
    expect(s.net).toBe(2550);
    expect(s.tips).toBe(300);
    expect(s.discounts).toBe(250);
    expect(s.average).toBe(1425);
    expect(s.byMethod).toEqual({ cash: 2550, card: 300, other: 0 });
  });

  it('ranks items and groups by hour', () => {
    expect(s.topItems[0]).toEqual({ name: 'Burger', qty: 2, revenue: 2500 });
    expect(s.byHour).toEqual({ 12: 2550, 13: 300 });
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

describe('salesCsvRows', () => {
  it('has no tax column', () => {
    const [header, first] = salesCsvRows(orders.slice(0, 1));
    expect(header).not.toContain('Tax');
    expect(first).toEqual([
      1,
      expect.any(String),
      'Table 1',
      '2x Burger',
      '25.00',
      '2.50',
      '3.00',
      '25.50',
      'cash',
      'paid',
    ]);
  });
});
