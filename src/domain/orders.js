/**
 * Order rules. Pure functions over plain data (no DOM), so they are easy to test.
 * Amounts are integer cents.
 *
 * An order is a table's (or takeaway's) bill: `lines` are what was ordered. Each time lines are
 * sent to the kitchen they become `dishes` (see kitchen.js), each with its own order and
 * completion time.
 *
 * Lifecycle: open → completed (when the kitchen has marked every dish ready) or void.
 */
import { uid } from '../utils/id.js';

export function calcTotals(order) {
  const subtotal = order.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  return { subtotal, total: subtotal };
}

export const orderLabel = (order) => (order.table != null ? `Table ${order.table}` : 'Takeaway');
export const itemCount = (order) => order.lines.reduce((n, l) => n + l.qty, 0);
export const unsentCount = (order) => order.lines.reduce((n, l) => n + Math.max(0, l.qty - l.sent), 0);
export const openOrders = (data) => data.orders.filter((o) => o.status === 'open');

/** Milliseconds from ordering to completion, or null if not completed (or no order time recorded). */
export const orderDuration = (order) =>
  order.createdAt && order.completedAt ? order.completedAt - order.createdAt : null;

/** `table` is a table number or 'take' for takeaway. */
export function createOrder(data, table, now = Date.now()) {
  const order = {
    id: uid(),
    no: data.seq++,
    table: table === 'take' ? null : table,
    createdAt: now,
    status: 'open',
    lines: [],
    dishes: [],
  };
  data.orders.push(order);
  return order;
}

/** Add one of a menu item, merging into an existing plain line for the same item and price. */
export function addItem(order, item) {
  const line = order.lines.find((l) => l.itemId === item.id && !l.note && l.price === item.price);
  if (line) line.qty += 1;
  else
    order.lines.push({
      id: uid(),
      itemId: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      sent: 0,
      note: '',
    });
}

export function setLineQty(order, lineId, qty) {
  const line = order.lines.find((l) => l.id === lineId);
  if (!line) return;
  if (qty <= 0) {
    order.lines = order.lines.filter((l) => l !== line);
  } else {
    line.qty = qty;
    line.sent = Math.min(line.sent, qty);
  }
}

export function setLineNote(order, lineId, note) {
  const line = order.lines.find((l) => l.id === lineId);
  if (line) line.note = note.trim();
}

/** Remove an order that never got items or sent any dishes. Returns true if removed. */
export function discardIfEmpty(data, order) {
  if (order.lines.length || order.dishes?.length) return false;
  data.orders = data.orders.filter((o) => o !== order);
  if (order.no === data.seq - 1) data.seq -= 1;
  return true;
}

/** `table` is a table number or 'take'. */
export function moveOrder(order, table) {
  order.table = table === 'take' ? null : table;
}

/** Close an order as a sale, freezing its totals. */
export function completeOrder(order, now = Date.now()) {
  order.status = 'completed';
  order.completedAt = now;
  order.totals = calcTotals(order);
}

/** Put a completed order back to open (the kitchen recalled one of its dishes). */
export function reopenOrder(order) {
  order.status = 'open';
  delete order.completedAt;
  delete order.totals;
}

/** Void an order. Its dishes leave the kitchen screen and are excluded from sales. */
export function voidOrder(order, now = Date.now()) {
  order.status = 'void';
  order.voidedAt = now;
}
