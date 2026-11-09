/**
 * Sales are counted per dish: a dish is a sale when the kitchen marks it ready.
 * Dishes on voided orders are excluded.
 */
import { dishDuration, dishesOf } from './kitchen.js';
import { orderLabel } from './orders.js';

/** Every dish completed in [start, end), newest first, with its order's number and label. */
export function completedDishes(allOrders, [start, end]) {
  const out = [];
  for (const order of allOrders) {
    if (order.status === 'void') continue;
    for (const d of dishesOf(order)) {
      if (d.completedAt && d.completedAt >= start && d.completedAt < end) {
        out.push({ ...d, orderId: order.id, orderNo: order.no, orderLabel: orderLabel(order) });
      }
    }
  }
  return out.sort((a, b) => b.completedAt - a.completedAt);
}

export function summarizeSales(allOrders, range) {
  const [start, end] = range;
  const dishes = completedDishes(allOrders, range);
  // Bills that finished (or were voided after finishing) on this day, for reprint / void.
  const orders = allOrders
    .filter((o) => o.completedAt && o.completedAt >= start && o.completedAt < end)
    .sort((a, b) => b.completedAt - a.completedAt);

  let total = 0;
  let itemsSold = 0;
  let durationSum = 0;
  let durationCount = 0;
  const byHour = {};
  const items = {};
  for (const d of dishes) {
    const amount = d.price * d.qty;
    total += amount;
    itemsSold += d.qty;
    const took = dishDuration(d);
    if (took != null) {
      durationSum += took;
      durationCount += 1;
    }
    const h = new Date(d.completedAt).getHours();
    byHour[h] = (byHour[h] || 0) + amount;
    const it = (items[d.name] ||= { name: d.name, qty: 0, revenue: 0 });
    it.qty += d.qty;
    it.revenue += amount;
  }

  return {
    dishes,
    orders,
    total,
    dishCount: dishes.length,
    itemsSold,
    tablesServed: orders.filter((o) => o.status === 'completed').length,
    /** Average sent → ready time per dish in ms, or null when nothing was completed. */
    averageDishTime: durationCount ? Math.round(durationSum / durationCount) : null,
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
const stamp = (ts) => (ts ? new Date(ts).toLocaleString() : '');

/** One CSV row per dish: the order log. */
export function dishCsvRows(dishes) {
  const header = ['Order', 'Table', 'Dish', 'Qty', 'Note', 'Ordered at', 'Completed at', 'Minutes', 'Amount'];
  const rows = [...dishes]
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((d) => {
      const took = dishDuration(d);
      return [
        d.orderNo,
        d.orderLabel,
        d.name,
        d.qty,
        d.note || '',
        stamp(d.orderedAt),
        stamp(d.completedAt),
        took == null ? '' : Math.round(took / 60000),
        dec(d.price * d.qty),
      ];
    });
  return [header, ...rows];
}
