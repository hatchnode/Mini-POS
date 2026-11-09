import { orderLabel } from './orders.js';

/**
 * Summarise orders completed in [start, end).
 * `orders` lists completed and voided orders (newest first); figures count completed orders only.
 */
export function summarizeSales(allOrders, [start, end]) {
  const orders = allOrders
    .filter((o) => o.completedAt && o.completedAt >= start && o.completedAt < end)
    .sort((a, b) => b.completedAt - a.completedAt);
  const completed = orders.filter((o) => o.status === 'completed');

  let total = 0;
  let itemsSold = 0;
  const byHour = {};
  const items = {};
  for (const o of completed) {
    total += o.totals.total;
    const h = new Date(o.completedAt).getHours();
    byHour[h] = (byHour[h] || 0) + o.totals.total;
    for (const l of o.lines) {
      itemsSold += l.qty;
      const it = (items[l.name] ||= { name: l.name, qty: 0, revenue: 0 });
      it.qty += l.qty;
      it.revenue += l.qty * l.price;
    }
  }

  return {
    orders,
    count: completed.length,
    total,
    itemsSold,
    average: completed.length ? Math.round(total / completed.length) : 0,
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
  const header = ['Order', 'Completed at', 'Order type', 'Items', 'Total', 'Status'];
  const rows = [...orders]
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((o) => [
      o.no,
      new Date(o.completedAt).toLocaleString(),
      orderLabel(o),
      o.lines.map((l) => `${l.qty}x ${l.name}`).join('; '),
      dec(o.totals.total),
      o.status,
    ]);
  return [header, ...rows];
}
