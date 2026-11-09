/**
 * Order rules. Pure functions over plain data (no DOM), so they are easy to test.
 * Amounts are integer cents.
 */
import { uid } from '../utils/id.js';

export function calcTotals(order) {
  const subtotal = order.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  let discount = 0;
  if (order.discount) {
    discount =
      order.discount.type === 'pct'
        ? Math.round((subtotal * order.discount.value) / 100)
        : Math.round(order.discount.value);
  }
  discount = Math.min(Math.max(discount, 0), subtotal);
  const tip = Math.max(0, order.tip || 0);
  return { subtotal, discount, tip, total: subtotal - discount + tip };
}

export const orderLabel = (order) => (order.table != null ? `Table ${order.table}` : 'Takeaway');
export const itemCount = (order) => order.lines.reduce((n, l) => n + l.qty, 0);
export const unsentCount = (order) => order.lines.reduce((n, l) => n + Math.max(0, l.qty - l.sent), 0);
export const openOrders = (data) => data.orders.filter((o) => o.status === 'open');

/** `table` is a table number or 'take' for takeaway. */
export function createOrder(data, table, now = Date.now()) {
  const order = {
    id: uid(),
    no: data.seq++,
    table: table === 'take' ? null : table,
    createdAt: now,
    status: 'open',
    lines: [],
    discount: null,
    tip: 0,
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

/** Remove an order that never got items or kitchen tickets. Returns true if removed. */
export function discardIfEmpty(data, order) {
  if (order.lines.length || data.tickets.some((t) => t.orderId === order.id)) return false;
  data.orders = data.orders.filter((o) => o !== order);
  if (order.no === data.seq - 1) data.seq -= 1;
  return true;
}

/** `table` is a table number or 'take'. */
export function moveOrder(data, order, table) {
  order.table = table === 'take' ? null : table;
  data.tickets.forEach((t) => {
    if (t.orderId === order.id) t.label = orderLabel(order);
  });
}

export function voidOrder(data, order, now = Date.now()) {
  order.status = 'void';
  order.voidedAt = now;
  data.tickets.forEach((t) => {
    if (t.orderId === order.id && !t.done) {
      t.done = true;
      t.doneAt = now;
    }
  });
}

/** Discount from the checkout form: a % (0–100) or an amount in cents. */
export function setDiscount(order, type, value) {
  order.discount = value > 0 ? { type, value: type === 'pct' ? Math.min(value, 100) : value } : null;
}
