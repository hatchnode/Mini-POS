/**
 * Payment status. There's no till or card terminal here: staff mark a bill as paid once the
 * customer has paid, any time (before or after eating). An order completes, and frees its table,
 * only when it is both served and paid. If the customer leaves without paying, staff record a
 * walk-out so the loss shows up in Sales instead of the order silently disappearing.
 */
import { completeIfDone, dishesOf, isServed } from './kitchen.js';
import { balanceDue, calcTotals } from './orders.js';

/** Mark the whole current bill as paid. Returns { ok, completed } or { ok: false, error }. */
export function markPaid(order, now = Date.now()) {
  if (order.status !== 'open') return { ok: false, error: 'This order is already closed' };
  if (!order.lines.length) return { ok: false, error: 'There is nothing to pay for yet' };
  if (balanceDue(order) === 0 && order.paidAt) return { ok: false, error: 'This bill is already paid' };
  order.paidAt = now;
  order.paidAmount = calcTotals(order).total;
  return { ok: true, completed: completeIfDone(order, now) };
}

/** Record that the customer left without paying. Frees the table; the loss shows in Sales. */
export function markWalkout(order, now = Date.now()) {
  if (order.status !== 'open') return { ok: false, error: 'This order is already closed' };
  if (!dishesOf(order).length)
    return { ok: false, error: 'Nothing was sent to the kitchen, so void it instead' };
  order.status = 'walkout';
  order.completedAt = now;
  order.totals = calcTotals(order);
  return { ok: true };
}

/** Open orders that still owe money, served ones first (those are the walk-out risk), then oldest. */
export function awaitingPayment(data) {
  return data.orders
    .filter((o) => o.status === 'open' && o.lines.length && balanceDue(o) > 0)
    .sort((a, b) => Number(isServed(b)) - Number(isServed(a)) || a.createdAt - b.createdAt);
}

/** 'paid' | 'unpaid' | 'served-unpaid' | 'walkout' | 'void' for badges and exports. */
export function paymentStatus(order) {
  if (order.status === 'walkout') return 'walkout';
  if (order.status === 'void') return 'void';
  if (balanceDue(order) === 0 && order.paidAt) return 'paid';
  return isServed(order) ? 'served-unpaid' : 'unpaid';
}

export const PAYMENT_STATUS_LABEL = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  'served-unpaid': 'Served · unpaid',
  walkout: 'Walked out',
  void: 'Void',
};
