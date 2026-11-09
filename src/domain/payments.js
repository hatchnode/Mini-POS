import { calcTotals } from './orders.js';

const NOTE_SIZES = [100, 500, 1000, 2000, 5000, 10000];

/** "Exact" plus the next few round amounts a customer is likely to hand over. */
export function quickTenderOptions(total) {
  return [total, ...NOTE_SIZES.map((u) => Math.ceil(total / u) * u)]
    .filter((v, i, all) => all.indexOf(v) === i && v >= total)
    .slice(0, 5);
}

/** Tip as a % of the amount after discount. */
export function tipFromPercent(order, pct) {
  const { subtotal, discount } = calcTotals({ ...order, tip: 0 });
  return Math.round(((subtotal - discount) * pct) / 100);
}

/**
 * Settle an order. `tendered` is cash received in cents (ignored for card/other).
 * Returns { ok: true } or { ok: false, error }.
 */
export function completePayment(order, { method, tendered = 0 }, now = Date.now()) {
  const totals = calcTotals(order);
  const isCash = method === 'cash';
  if (isCash && tendered < totals.total) return { ok: false, error: 'Cash received is less than the total' };
  order.status = 'paid';
  order.paidAt = now;
  order.totals = totals;
  order.payment = {
    method,
    tendered: isCash ? tendered : totals.total,
    change: isCash ? tendered - totals.total : 0,
  };
  return { ok: true };
}
