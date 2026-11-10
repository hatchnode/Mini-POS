/**
 * Regular customers and a simple stamp-card reward. A customer is a name and (optionally) a phone
 * number that staff look up at the till; nothing is ever sent to them. Attaching a customer to an
 * order counts it as a visit once the bill is paid. After every `perReward` paid visits the
 * customer is owed one reward, which staff redeem onto an order as a free line (so it goes to the
 * kitchen and prints on the receipt at 0.00).
 *
 *   customer = { id, name, phone, createdAt, redeemed }   // redeemed: rewards used so far
 */
import { uid } from '../utils/id.js';
import { billTotal } from './orders.js';
import { paymentStatus } from './payments.js';

const digits = (phone) => String(phone || '').replace(/\D/g, '');

export const findCustomer = (data, id) => (data.customers || []).find((c) => c.id === id) || null;

const phoneTaken = (data, phone, exceptId) =>
  !!digits(phone) && data.customers.some((c) => c.id !== exceptId && digits(c.phone) === digits(phone));

export function addCustomer(data, { name = '', phone = '' }, now = Date.now()) {
  const finalName = name.trim();
  if (!finalName) return { ok: false, error: 'Enter the customer’s name' };
  if (phoneTaken(data, phone))
    return { ok: false, error: 'A customer with that phone number already exists' };
  const customer = { id: uid(), name: finalName, phone: phone.trim(), createdAt: now, redeemed: 0 };
  data.customers.push(customer);
  return { ok: true, customer };
}

export function updateCustomer(data, id, { name, phone }) {
  const customer = findCustomer(data, id);
  if (!customer) return { ok: false, error: 'Customer not found' };
  if (name != null) {
    if (!name.trim()) return { ok: false, error: 'A customer needs a name' };
    customer.name = name.trim();
    data.orders.forEach((o) => {
      if (o.customerId === id) o.customerName = customer.name;
    });
  }
  if (phone != null) {
    if (phoneTaken(data, phone, id))
      return { ok: false, error: 'A customer with that phone number already exists' };
    customer.phone = phone.trim();
  }
  return { ok: true, customer };
}

/** Remove a customer. Their past orders keep the name but no longer count towards anyone. */
export function removeCustomer(data, id) {
  data.customers = data.customers.filter((c) => c.id !== id);
  data.orders.forEach((o) => {
    if (o.customerId === id) delete o.customerId;
  });
}

/** Paid visits, money spent and last visit for every customer: Map of id → { visits, spent, lastVisit }. */
export function customerStats(data) {
  const stats = new Map((data.customers || []).map((c) => [c.id, { visits: 0, spent: 0, lastVisit: null }]));
  for (const o of data.orders) {
    const s = o.customerId && stats.get(o.customerId);
    if (!s || paymentStatus(o) !== 'paid') continue;
    s.visits += 1;
    s.spent += billTotal(o);
    s.lastVisit = Math.max(s.lastVisit || 0, o.paidAt);
  }
  return stats;
}

/**
 * Where a customer is on the stamp card. `due` is how many rewards they can claim now and
 * `progress` the visits made towards the next one. Returns null when rewards are switched off.
 */
export function rewardStatus(customer, visits, perReward) {
  if (!perReward || perReward <= 0) return null;
  const due = Math.max(0, Math.floor(visits / perReward) - (customer.redeemed || 0));
  return { due, progress: visits % perReward, perReward };
}

/** Customers matching a name or phone search; with no search, the most recently added. */
export function searchCustomers(data, query, limit = 8) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  const list = [...(data.customers || [])].sort((a, b) => b.createdAt - a.createdAt);
  if (!q) return list.slice(0, limit);
  const qDigits = digits(q);
  return list
    .filter((c) => c.name.toLowerCase().includes(q) || (qDigits && digits(c.phone).includes(qDigits)))
    .slice(0, limit);
}

export function attachCustomer(order, customer) {
  order.customerId = customer.id;
  order.customerName = customer.name;
}

/** Take the customer off an order. Refuses while a reward is on the bill: remove that line first. */
export function detachCustomer(order) {
  if (order.lines.some((l) => l.reward)) return false;
  delete order.customerId;
  delete order.customerName;
  return true;
}

/** Add the customer's reward to the order as a free line. One reward per order. */
export function redeemReward(order, customer, rewardName) {
  if (order.lines.some((l) => l.reward)) return { ok: false, error: 'This order already has a reward on it' };
  const line = {
    id: uid(),
    itemId: null,
    name: `Reward: ${rewardName}`,
    price: 0,
    qty: 1,
    sent: 0,
    note: '',
    reward: true,
  };
  order.lines.push(line);
  customer.redeemed = (customer.redeemed || 0) + 1;
  return { ok: true, line };
}

/** A reward line was taken off the bill again: the customer gets the reward back. */
export function returnReward(data, order) {
  const customer = findCustomer(data, order.customerId);
  if (customer && customer.redeemed > 0) customer.redeemed -= 1;
}
