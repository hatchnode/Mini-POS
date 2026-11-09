import { describe, expect, it } from 'vitest';
import {
  addItem,
  calcTotals,
  createOrder,
  discardIfEmpty,
  moveOrder,
  setLineQty,
  unsentCount,
  voidOrder,
} from '../src/domain/orders.js';
import { completesOrder, createTicket, markTicketReady, recallTicket } from '../src/domain/kitchen.js';

const burger = { id: 'b', name: 'Burger', price: 1250 };
const fries = { id: 'f', name: 'Fries', price: 450 };
const emptyData = () => ({ orders: [], tickets: [], seq: 1 });

describe('calcTotals', () => {
  it('is the sum of the lines', () => {
    const order = {
      lines: [
        { price: 1250, qty: 2 },
        { price: 450, qty: 1 },
      ],
    };
    expect(calcTotals(order)).toEqual({ subtotal: 2950, total: 2950 });
  });
});

describe('building an order', () => {
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
});

describe('kitchen completes orders', () => {
  it('completes the order when its only ticket is marked ready', () => {
    const data = emptyData();
    const order = createOrder(data, 4);
    addItem(order, burger);
    addItem(order, fries);
    const ticket = createTicket(data, order);
    expect(completesOrder(data, ticket)).toBe(true);
    expect(markTicketReady(data, ticket, 500)).toBe(order);
    expect(order.status).toBe('completed');
    expect(order.completedAt).toBe(500);
    expect(order.totals.total).toBe(1700);
  });

  it('waits for every ticket of the order', () => {
    const data = emptyData();
    const order = createOrder(data, 4);
    addItem(order, burger);
    const first = createTicket(data, order);
    addItem(order, fries);
    const second = createTicket(data, order);
    expect(completesOrder(data, first)).toBe(false);
    expect(markTicketReady(data, first)).toBeNull();
    expect(order.status).toBe('open');
    expect(markTicketReady(data, second)).toBe(order);
    expect(order.status).toBe('completed');
  });

  it('stays open while items are waiting to be sent', () => {
    const data = emptyData();
    const order = createOrder(data, 4);
    addItem(order, burger);
    const ticket = createTicket(data, order);
    addItem(order, fries); // added but not sent yet
    expect(markTicketReady(data, ticket)).toBeNull();
    expect(order.status).toBe('open');
  });

  it('recalling a ticket reopens a completed order', () => {
    const data = emptyData();
    const order = createOrder(data, 4);
    addItem(order, burger);
    const ticket = createTicket(data, order);
    markTicketReady(data, ticket);
    expect(recallTicket(data, ticket)).toBe(order);
    expect(order.status).toBe('open');
    expect(order.completedAt).toBeUndefined();
    expect(ticket.done).toBe(false);
  });

  it('does not complete a voided order', () => {
    const data = emptyData();
    const order = createOrder(data, 4);
    addItem(order, burger);
    const ticket = createTicket(data, order);
    voidOrder(data, order);
    expect(markTicketReady(data, ticket)).toBeNull();
    expect(order.status).toBe('void');
  });
});
