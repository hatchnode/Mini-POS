import { PAYMENT_METHODS } from '../config.js';
import { orderLabel } from './orders.js';

/**
 * Summarise orders settled in [start, end).
 * `orders` lists paid and voided orders (newest first); figures count paid orders only.
 */
export function summarizeSales(allOrders, [start, end]) {
  const orders = allOrders
    .filter((o) => o.paidAt && o.paidAt >= start && o.paidAt < end)
    .sort((a, b) => b.paidAt - a.paidAt);
  const paid = orders.filter((o) => o.status === 'paid');
  const sum = (pick) => paid.reduce((s, o) => s + pick(o.totals), 0);

  const total = sum((t) => t.total);
  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0]));
  const byHour = {};
  const items = {};
  for (const o of paid) {
    byMethod[o.payment.method] = (byMethod[o.payment.method] || 0) + o.totals.total;
    const h = new Date(o.paidAt).getHours();
    byHour[h] = (byHour[h] || 0) + o.totals.total;
    for (const l of o.lines) {
      const it = (items[l.name] ||= { name: l.name, qty: 0, revenue: 0 });
      it.qty += l.qty;
      it.revenue += l.qty * l.price;
    }
  }

  return {
    orders,
    count: paid.length,
    total,
    net: sum((t) => t.subtotal - t.discount),
    tips: sum((t) => t.tip),
    discounts: sum((t) => t.discount),
    average: paid.length ? Math.round(total / paid.length) : 0,
    byMethod,
    byHour,
    topItems: Object.values(items)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
  };
}

/** Hours to chart: the active range padded so a single busy hour isn't one giant bar. */
export function chartHours(byHour) {
  const hours = Object.keys(byHour).map(Number);
  if (!hours.length) return [];
  const lo = Math.max(0, Math.min(...hours) - 1);
  const hi = Math.min(23, Math.max(Math.max(...hours) + 1, lo + 7));
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

const dec = (c) => (c / 100).toFixed(2);

export function salesCsvRows(orders) {
  const header = [
    'Order',
    'Paid at',
    'Order type',
    'Items',
    'Subtotal',
    'Discount',
    'Tip',
    'Total',
    'Payment',
    'Status',
  ];
  const rows = [...orders]
    .sort((a, b) => a.paidAt - b.paidAt)
    .map((o) => [
      o.no,
      new Date(o.paidAt).toLocaleString(),
      orderLabel(o),
      o.lines.map((l) => `${l.qty}x ${l.name}`).join('; '),
      dec(o.totals.subtotal),
      dec(o.totals.discount),
      dec(o.totals.tip),
      dec(o.totals.total),
      o.payment.method,
      o.status,
    ]);
  return [header, ...rows];
}
