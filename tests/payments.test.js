import { describe, expect, it } from 'vitest';
import { addItem, balanceDue, createOrder, isPaid } from '../src/domain/orders.js';
import { markDishReady, sendToKitchen } from '../src/domain/kitchen.js';
import {
  awaitingPayment,
  markPaid,
  markWalkout,
  paymentStatus,
  paymentsOf,
  settledPayments,
} from '../src/domain/payments.js';
import { summarizeSales } from '../src/domain/sales.js';

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

describe('payment methods', () => {
  it('records how each payment was made and who took it', () => {
    const order = servedOrder(emptyData());
    expect(markPaid(order, 3000, { method: 'Cash', staff: 'Ana' })).toEqual({ ok: true, completed: true });
    expect(order.payments).toEqual([{ at: 3000, amount: 1250, method: 'Cash', staff: 'Ana' }]);
  });

  it('keeps a second payment for items added later', () => {
    const order = createOrder(emptyData(), null);
    addItem(order, burger);
    markPaid(order, 1000, { method: 'Cash' });
    addItem(order, fries);
    markPaid(order, 2000, { method: 'Card' });
    expect(order.payments.map((p) => [p.method, p.amount])).toEqual([
      ['Cash', 1250],
      ['Card', 450],
    ]);
  });

  it('treats bills paid before methods existed as one unrecorded payment', () => {
    const old = { paidAt: 500, paidAmount: 900, lines: [], totals: { total: 900 } };
    expect(paymentsOf(old)).toEqual([{ at: 500, amount: 900, method: null }]);
  });

  it('takes a later removal off the last payment', () => {
    const order = createOrder(emptyData(), null);
    addItem(order, burger);
    addItem(order, fries);
    markPaid(order, 1000, { method: 'Card' });
    order.lines.pop();
    expect(settledPayments(order).map((p) => p.amount)).toEqual([1250]);
  });

  it('splits paid sales by method and by who took the payment', () => {
    const data = emptyData();
    const a = servedOrder(data, 1);
    const b = servedOrder(data, 2);
    const c = servedOrder(data, 3);
    markPaid(a, 3000, { method: 'Cash', staff: 'Ana' });
    markPaid(b, 3000, { method: 'Card', staff: 'Ana' });
    markPaid(c, 3000, { method: 'Cash', staff: 'Ben' });
    const s = summarizeSales(data.orders, [0, 10000]);
    expect(s.byMethod).toEqual([
      { name: 'Cash', amount: 2500, count: 2 },
      { name: 'Card', amount: 1250, count: 1 },
    ]);
    expect(s.cashTotal).toBe(2500);
    expect(s.byStaff.map((r) => [r.name, r.amount])).toEqual([
      ['Ana', 2500],
      ['Ben', 1250],
    ]);
  });
});
