/**
 * Sales figures. Money counts only bills that were paid (on the day they were paid). Walk-outs
 * (served but never paid) are reported separately as a loss. The dish log covers every dish the
 * kitchen completed that day, for timing, whatever happened to the bill afterwards (except void).
 */
import { dishDuration, dishesOf } from './kitchen.js';
import { billTotal, orderLabel } from './orders.js';
import { PAYMENT_STATUS_LABEL, paymentStatus } from './payments.js';

const within = (ts, [start, end]) => !!ts && ts >= start && ts < end;

/** Every dish completed in [start, end), newest first, with its order's number, label and bill status. */
export function completedDishes(allOrders, range) {
  const out = [];
  for (const order of allOrders) {
    if (order.status === 'void') continue;
    for (const d of dishesOf(order)) {
      if (within(d.completedAt, range)) {
        out.push({
          ...d,
          orderId: order.id,
          orderNo: order.no,
          orderLabel: orderLabel(order),
          bill: paymentStatus(order),
        });
      }
    }
  }
  return out.sort((a, b) => b.completedAt - a.completedAt);
}

/** When a bill was settled for the day's list: paid time, otherwise when it was closed. */
export const settledAt = (o) => o.paidAt ?? o.completedAt ?? o.voidedAt ?? null;

export function summarizeSales(allOrders, range) {
  const dishes = completedDishes(allOrders, range);
  const isPaidBill = (o) => paymentStatus(o) === 'paid';

  // Paid bills, plus walk-outs and voids closed that day, for the bills list.
  const bills = allOrders
    .filter(
      (o) => (isPaidBill(o) || o.status === 'walkout' || o.status === 'void') && within(settledAt(o), range),
    )
    .sort((a, b) => settledAt(b) - settledAt(a));
  const paid = bills.filter(isPaidBill);
  const walkouts = bills.filter((o) => o.status === 'walkout');

  let total = 0;
  const byHour = {};
  const items = {};
  for (const o of paid) {
    const amount = billTotal(o);
    total += amount;
    const h = new Date(o.paidAt).getHours();
    byHour[h] = (byHour[h] || 0) + amount;
    for (const l of o.lines) {
      const it = (items[l.name] ||= { name: l.name, qty: 0, revenue: 0 });
      it.qty += l.qty;
      it.revenue += l.qty * l.price;
    }
  }

  let durationSum = 0;
  let durationCount = 0;
  let itemsSold = 0;
  for (const d of dishes) {
    itemsSold += d.qty;
    const took = dishDuration(d);
    if (took != null) {
      durationSum += took;
      durationCount += 1;
    }
  }

  return {
    dishes,
    bills,
    total,
    paidCount: paid.length,
    average: paid.length ? Math.round(total / paid.length) : 0,
    walkoutCount: walkouts.length,
    walkoutTotal: walkouts.reduce((s, o) => s + billTotal(o), 0),
    dishCount: dishes.length,
    itemsSold,
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

/** One CSV row per dish: the order log, with the bill's payment status. */
export function dishCsvRows(dishes) {
  const header = [
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
  ];
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
        PAYMENT_STATUS_LABEL[d.bill] || d.bill,
      ];
    });
  return [header, ...rows];
}
