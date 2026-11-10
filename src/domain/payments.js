/**
 * Payment status. There's no card terminal here: staff mark a bill as paid once the customer has
 * paid, any time (before or after eating), and say how it was paid (cash, card, …). An order
 * completes, and frees its table, only when it is both served and paid. If the customer leaves
 * without paying, staff record a walk-out so the loss shows up in Sales instead of the order
 * silently disappearing.
 *
 * Each payment is kept on the order: `order.payments = [{ at, amount, method, staff? }]`.
 */
import { completeIfDone, dishesOf, isServed } from './kitchen.js';
import { balanceDue, billTotal, calcTotals } from './orders.js';

/**
 * Mark the whole current bill as paid. `method` is how it was paid and `staff` who took it.
 * Returns { ok, completed } or { ok: false, error }.
 */
export function markPaid(order, now = Date.now(), { method = null, staff = null } = {}) {
  if (order.status !== 'open') return { ok: false, error: 'This order is already closed' };
  if (!order.lines.length) return { ok: false, error: 'There is nothing to pay for yet' };
  const due = balanceDue(order);
  if (due === 0 && order.paidAt) return { ok: false, error: 'This bill is already paid' };
  const payment = { at: now, amount: due, method };
  if (staff) payment.staff = staff;
  order.payments = [...(order.payments || []), payment];
  order.paidAt = now;
  order.paidAmount = calcTotals(order).total;
  return { ok: true, completed: completeIfDone(order, now) };
}

/** Payments taken on an order. Bills paid before methods were recorded count as one payment. */
export function paymentsOf(order) {
  if (order.payments?.length) return order.payments;
  if (!order.paidAt) return [];
  return [{ at: order.paidAt, amount: order.paidAmount ?? billTotal(order), method: null }];
}

/**
 * Payments adjusted to add up to the final bill. If something was taken off the bill after it was
 * paid, the difference comes off the last payment (that is where a refund would come from).
 */
export function settledPayments(order) {
  const list = paymentsOf(order).map((p) => ({ ...p }));
  if (!list.length) return list;
  const diff = billTotal(order) - list.reduce((sum, p) => sum + p.amount, 0);
  if (diff) list[list.length - 1].amount += diff;
  return list;
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
