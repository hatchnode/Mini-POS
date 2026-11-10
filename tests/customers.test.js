import { describe, expect, it } from 'vitest';
import {
  addCustomer,
  attachCustomer,
  customerStats,
  detachCustomer,
  redeemReward,
  removeCustomer,
  returnReward,
  rewardStatus,
  searchCustomers,
  updateCustomer,
} from '../src/domain/customers.js';
import { markDishReady, sendToKitchen } from '../src/domain/kitchen.js';
import { addItem, calcTotals, createOrder } from '../src/domain/orders.js';
import { markPaid } from '../src/domain/payments.js';

const burger = { id: 'b', name: 'Burger', price: 1250 };
const emptyData = () => ({ orders: [], seq: 1, customers: [] });

function paidVisit(data, customer, at = 1000) {
  const order = createOrder(data, null, at);
  if (customer) attachCustomer(order, customer);
  addItem(order, burger);
  sendToKitchen(order, at).forEach((d) => markDishReady(order, d.id, at));
  markPaid(order, at);
  return order;
}

describe('customers', () => {
  it('adds customers and refuses blank names or a repeated phone', () => {
    const data = emptyData();
    expect(addCustomer(data, { name: 'Mia', phone: '555 0101' }).ok).toBe(true);
    expect(addCustomer(data, { name: '', phone: '1' }).ok).toBe(false);
    expect(addCustomer(data, { name: 'Other', phone: '(555) 01-01' }).ok).toBe(false);
    expect(addCustomer(data, { name: 'No Phone' }).ok).toBe(true);
    expect(addCustomer(data, { name: 'No Phone 2' }).ok).toBe(true);
  });

  it('finds by part of a name or phone', () => {
    const data = emptyData();
    addCustomer(data, { name: 'Mia Wong', phone: '555-0101' }, 1);
    addCustomer(data, { name: 'Sam', phone: '555-0202' }, 2);
    expect(searchCustomers(data, 'wong').map((c) => c.name)).toEqual(['Mia Wong']);
    expect(searchCustomers(data, '0202').map((c) => c.name)).toEqual(['Sam']);
    expect(searchCustomers(data, '').map((c) => c.name)).toEqual(['Sam', 'Mia Wong']);
  });

  it('counts only paid visits', () => {
    const data = emptyData();
    const mia = addCustomer(data, { name: 'Mia' }).customer;
    paidVisit(data, mia, 1000);
    paidVisit(data, mia, 5000);
    paidVisit(data, null, 6000);
    const open = createOrder(data, null, 7000);
    attachCustomer(open, mia);
    addItem(open, burger);
    expect(customerStats(data).get(mia.id)).toEqual({ visits: 2, spent: 2500, lastVisit: 5000 });
  });

  it('renames on past orders and forgets a removed customer', () => {
    const data = emptyData();
    const mia = addCustomer(data, { name: 'Mia' }).customer;
    const order = paidVisit(data, mia);
    updateCustomer(data, mia.id, { name: 'Mia W.' });
    expect(order.customerName).toBe('Mia W.');
    removeCustomer(data, mia.id);
    expect([order.customerId, order.customerName, data.customers.length]).toEqual([undefined, 'Mia W.', 0]);
  });
});

describe('rewards', () => {
  it('owes a reward after every N paid visits', () => {
    const c = { redeemed: 0 };
    expect(rewardStatus(c, 9, 10)).toEqual({ due: 0, progress: 9, perReward: 10 });
    expect(rewardStatus(c, 10, 10)).toEqual({ due: 1, progress: 0, perReward: 10 });
    expect(rewardStatus({ redeemed: 1 }, 23, 10)).toEqual({ due: 1, progress: 3, perReward: 10 });
    expect(rewardStatus(c, 50, 0)).toBe(null);
  });

  it('redeems as a free line, once per order, and can be undone', () => {
    const data = emptyData();
    const mia = addCustomer(data, { name: 'Mia' }).customer;
    const order = createOrder(data, null);
    attachCustomer(order, mia);
    addItem(order, burger);
    expect(redeemReward(order, mia, 'Free drink').ok).toBe(true);
    expect(redeemReward(order, mia, 'Free drink').ok).toBe(false);
    expect([mia.redeemed, calcTotals(order).total, order.lines[1].name]).toEqual([
      1,
      1250,
      'Reward: Free drink',
    ]);
    expect(detachCustomer(order)).toBe(false);
    order.lines.pop();
    returnReward(data, order);
    expect(mia.redeemed).toBe(0);
    expect(detachCustomer(order)).toBe(true);
    expect(order.customerId).toBeUndefined();
  });
});
