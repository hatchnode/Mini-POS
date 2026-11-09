import { describe, expect, it } from 'vitest';
import { addItem, balanceDue, createOrder, isPaid } from '../src/domain/orders.js';
import { markDishReady, sendToKitchen } from '../src/domain/kitchen.js';
import { awaitingPayment, markPaid, markWalkout, paymentStatus } from '../src/domain/payments.js';

const burger = { id: 'b', name: 'Burger', price: 1250 };
const fries = { id: 'f', name: 'Fries', price: 450 };
const emptyData = () => ({ orders: [], seq: 1 });

function servedOrder(data, tableNo = 1) {
  const order = createOrder(data, { id: `t${tableNo}`, name: String(tableNo) }, 1000);
  addItem(order, burger);
  sendToKitchen(order, 1000).forEach((d) => markDishReady(order, d.id, 2000));
  return order;
}

describe('markPaid', () => {
  it('records the time and amount paid', () => {
    const order = servedOrder(emptyData());
    expect(paymentStatus(order)).toBe('served-unpaid');
    markPaid(order, 3000);
    expect([order.paidAt, order.paidAmount, isPaid(order)]).toEqual([3000, 1250, true]);
    expect(paymentStatus(order)).toBe('paid');
  });

  it('owes the difference if items are added after paying', () => {
    const data = emptyData();
    const order = createOrder(data, null);
    addItem(order, burger);
    markPaid(order);
    addItem(order, fries);
    expect(isPaid(order)).toBe(false);
    expect(balanceDue(order)).toBe(450);
    markPaid(order);
    expect(isPaid(order)).toBe(true);
  });

  it('refuses empty, already-paid or closed bills', () => {
    const data = emptyData();
    const empty = createOrder(data, null);
    expect(markPaid(empty).ok).toBe(false);
    const order = servedOrder(data);
    markPaid(order);
    expect(markPaid(order).ok).toBe(false);
  });
});

describe('markWalkout', () => {
  it('closes a served, unpaid order as a walk-out with its total', () => {
    const order = servedOrder(emptyData());
    expect(markWalkout(order, 4000)).toEqual({ ok: true });
    expect([order.status, order.completedAt, order.totals.total]).toEqual(['walkout', 4000, 1250]);
    expect(paymentStatus(order)).toBe('walkout');
  });

  it('asks for a void when nothing was sent to the kitchen', () => {
    const order = createOrder(emptyData(), null);
    addItem(order, burger);
    expect(markWalkout(order).ok).toBe(false);
  });
});

describe('awaitingPayment', () => {
  it('lists open bills that owe money, served ones first', () => {
    const data = emptyData();
    const cooking = createOrder(data, { id: 't1', name: '1' }, 500);
    addItem(cooking, fries);
    sendToKitchen(cooking);
    const served = servedOrder(data, 2);
    const paid = servedOrder(data, 3);
    markPaid(paid);
    expect(awaitingPayment(data)).toEqual([served, cooking]);
  });
});
