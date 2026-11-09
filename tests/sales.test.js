import { describe, expect, it } from 'vitest';
import { chartHours, salesCsvRows, summarizeSales } from '../src/domain/sales.js';

const at = (h) => new Date(2026, 10, 9, h, 15).getTime();
const day = [new Date(2026, 10, 9).getTime(), new Date(2026, 10, 10).getTime()];

const completed = (no, h, lines) => {
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  return { no, table: 1, status: 'completed', completedAt: at(h), lines, totals: { subtotal: total, total } };
};

const orders = [
  completed(1, 12, [{ name: 'Burger', price: 1250, qty: 2 }]),
  completed(2, 13, [{ name: 'Coffee', price: 300, qty: 1 }]),
  { ...completed(3, 14, [{ name: 'Tea', price: 275, qty: 1 }]), status: 'void' },
  { ...completed(4, 9, [{ name: 'Tea', price: 999, qty: 1 }]), completedAt: at(9) - 864e5 }, // previous day
  { no: 5, table: 2, status: 'open', lines: [{ name: 'Fries', price: 450, qty: 1 }] },
];

describe('summarizeSales', () => {
  const s = summarizeSales(orders, day);

  it('lists the day’s completed and voided orders, newest first', () => {
    expect(s.orders.map((o) => o.no)).toEqual([3, 2, 1]);
  });

  it('counts completed orders only', () => {
    expect(s.count).toBe(2);
    expect(s.total).toBe(2800);
    expect(s.average).toBe(1400);
    expect(s.itemsSold).toBe(3);
  });

  it('ranks items and groups by hour', () => {
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

describe('salesCsvRows', () => {
  it('has no payment, tip or tax columns', () => {
    const [header, first] = salesCsvRows(orders.slice(0, 1));
    expect(header).toEqual(['Order', 'Completed at', 'Order type', 'Items', 'Total', 'Status']);
    expect(first).toEqual([1, expect.any(String), 'Table 1', '2x Burger', '25.00', 'completed']);
  });
});
