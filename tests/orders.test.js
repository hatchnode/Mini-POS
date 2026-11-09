import { describe, expect, it } from 'vitest';
import {
  addItem,
  calcTotals,
  createOrder,
  discardIfEmpty,
  moveOrder,
  setDiscount,
  setLineQty,
  unsentCount,
  voidOrder,
} from '../src/domain/orders.js';
import { createTicket } from '../src/domain/kitchen.js';

const burger = { id: 'b', name: 'Burger', price: 1250 };
const fries = { id: 'f', name: 'Fries', price: 450 };
const emptyData = () => ({ orders: [], tickets: [], seq: 1 });

describe('calcTotals', () => {
  it('sums lines with no tax', () => {
    const order = {
      lines: [
        { price: 1250, qty: 2 },
        { price: 450, qty: 1 },
      ],
      discount: null,
      tip: 0,
    };
    expect(calcTotals(order)).toEqual({ subtotal: 2950, discount: 0, tip: 0, total: 2950 });
  });

  it('applies a percentage discount then adds the tip', () => {
    const order = { lines: [{ price: 3600, qty: 1 }], discount: { type: 'pct', value: 10 }, tip: 486 };
    expect(calcTotals(order)).toEqual({ subtotal: 3600, discount: 360, tip: 486, total: 3726 });
  });

  it('never discounts below zero', () => {
    const order = { lines: [{ price: 500, qty: 1 }], discount: { type: 'amt', value: 9999 }, tip: 0 };
    expect(calcTotals(order).total).toBe(0);
  });
});

describe('order lifecycle', () => {
  it('numbers orders and merges repeat items', () => {
    const data = emptyData();
    const order = createOrder(data, 3);
    addItem(order, burger);
    addItem(order, burger);
    addItem(order, fries);
    expect(order.no).toBe(1);
    expect(order.table).toBe(3);
    expect(order.lines).toHaveLength(2);
    expect(order.lines[0].qty).toBe(2);
  });

  it('does not merge into a line that has a note', () => {
    const order = createOrder(emptyData(), 1);
    addItem(order, burger);
    order.lines[0].note = 'No onions';
    addItem(order, burger);
    expect(order.lines).toHaveLength(2);
  });

  it('sends only new items to the kitchen', () => {
    const data = emptyData();
    const order = createOrder(data, 1);
    addItem(order, burger);
    expect(createTicket(data, order).lines).toEqual([{ name: 'Burger', qty: 1, note: '' }]);
    addItem(order, burger);
    addItem(order, fries);
    expect(unsentCount(order)).toBe(2);
    expect(createTicket(data, order).lines.map((l) => [l.name, l.qty])).toEqual([
      ['Burger', 1],
      ['Fries', 1],
    ]);
    expect(createTicket(data, order)).toBeNull();
  });

  it('removes a line at zero and discards an untouched empty order', () => {
    const data = emptyData();
    const order = createOrder(data, 'take');
    addItem(order, fries);
    setLineQty(order, order.lines[0].id, 0);
    expect(discardIfEmpty(data, order)).toBe(true);
    expect(data.orders).toHaveLength(0);
    expect(data.seq).toBe(1);
  });

  it('keeps an empty order that already reached the kitchen', () => {
    const data = emptyData();
    const order = createOrder(data, 2);
    addItem(order, fries);
    createTicket(data, order);
    setLineQty(order, order.lines[0].id, 0);
    expect(discardIfEmpty(data, order)).toBe(false);
  });

  it('relabels kitchen tickets when an order moves', () => {
    const data = emptyData();
    const order = createOrder(data, 2);
    addItem(order, fries);
    createTicket(data, order);
    moveOrder(data, order, 'take');
    expect(data.tickets[0].label).toBe('Takeaway');
  });

  it('voiding closes its open tickets', () => {
    const data = emptyData();
    const order = createOrder(data, 2);
    addItem(order, fries);
    createTicket(data, order);
    voidOrder(data, order);
    expect(order.status).toBe('void');
    expect(data.tickets[0].done).toBe(true);
  });

  it('caps percentage discounts at 100 and clears zero discounts', () => {
    const order = createOrder(emptyData(), 1);
    setDiscount(order, 'pct', 150);
    expect(order.discount).toEqual({ type: 'pct', value: 100 });
    setDiscount(order, 'pct', 0);
    expect(order.discount).toBeNull();
  });
});
