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
import {
  cancelPending,
  completeIfDone,
  completesOrder,
  dishUrgency,
  kitchenQueue,
  lineKitchenStatus,
  markDishReady,
  pendingDishCount,
  readyDishes,
  recallDish,
  sendToKitchen,
} from '../src/domain/kitchen.js';

const burger = { id: 'b', name: 'Burger', price: 1250 };
const fries = { id: 'f', name: 'Fries', price: 450 };
const emptyData = () => ({ orders: [], seq: 1 });

/** An order on `table` with the given items added (not sent). */
function orderWith(data, table, ...items) {
  const order = createOrder(data, table, 1000);
  items.forEach((i) => addItem(order, i));
  return order;
}

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
    const order = orderWith(data, 3, burger, burger, fries);
    expect(order.no).toBe(1);
    expect(order.table).toBe(3);
    expect(order.lines).toHaveLength(2);
    expect(order.lines[0].qty).toBe(2);
  });

  it('does not merge into a line that has a note', () => {
    const order = orderWith(emptyData(), 1, burger);
    order.lines[0].note = 'No onions';
    addItem(order, burger);
    expect(order.lines).toHaveLength(2);
  });

  it('removes a line at zero and discards an untouched empty order', () => {
    const data = emptyData();
    const order = orderWith(data, 'take', fries);
    setLineQty(order, order.lines[0].id, 0);
    expect(discardIfEmpty(data, order)).toBe(true);
    expect(data.orders).toHaveLength(0);
    expect(data.seq).toBe(1);
  });

  it('keeps an empty order that already sent dishes', () => {
    const data = emptyData();
    const order = orderWith(data, 2, fries);
    sendToKitchen(order);
    markDishReady(order, order.dishes[0].id);
    expect(discardIfEmpty(data, order)).toBe(false);
  });

  it('moves between tables and to takeaway', () => {
    const order = orderWith(emptyData(), 2, fries);
    moveOrder(order, 5);
    expect(order.table).toBe(5);
    moveOrder(order, 'take');
    expect(order.table).toBeNull();
  });
});

describe('sending dishes', () => {
  it('turns each line into one dish with its own order time', () => {
    const order = orderWith(emptyData(), 1, burger, burger, fries);
    const sent = sendToKitchen(order, 5000);
    expect(sent.map((d) => [d.name, d.qty, d.price, d.orderedAt, d.completedAt])).toEqual([
      ['Burger', 2, 1250, 5000, null],
      ['Fries', 1, 450, 5000, null],
    ]);
    expect(unsentCount(order)).toBe(0);
    expect(sendToKitchen(order)).toEqual([]);
  });

  it('sends only what was added since, as new dishes with a later order time', () => {
    const order = orderWith(emptyData(), 1, burger);
    sendToKitchen(order, 5000);
    addItem(order, burger);
    const [later] = sendToKitchen(order, 9000);
    expect([later.name, later.qty, later.orderedAt]).toEqual(['Burger', 1, 9000]);
    expect(order.dishes).toHaveLength(2);
  });
});

describe('completing dishes', () => {
  it('records each dish’s completion time and frees the table after the last one', () => {
    const order = orderWith(emptyData(), 4, burger, fries);
    const [b, f] = sendToKitchen(order, 5000);

    expect(completesOrder(order, b)).toBe(false);
    expect(markDishReady(order, b.id, 6000)).toEqual({ dish: b, completed: false });
    expect(b.completedAt).toBe(6000);
    expect(order.status).toBe('open');

    expect(completesOrder(order, f)).toBe(true);
    expect(markDishReady(order, f.id, 7000).completed).toBe(true);
    expect(f.completedAt).toBe(7000);
    expect(order.status).toBe('completed');
    expect(order.completedAt).toBe(7000);
    expect(order.totals.total).toBe(1700);
  });

  it('keeps the table open while dishes are waiting to be sent', () => {
    const order = orderWith(emptyData(), 4, burger);
    const [b] = sendToKitchen(order);
    addItem(order, fries); // added, not sent
    expect(markDishReady(order, b.id).completed).toBe(false);
    expect(order.status).toBe('open');
  });

  it('cannot mark a dish twice or on a voided order', () => {
    const order = orderWith(emptyData(), 4, burger, fries);
    const [b, f] = sendToKitchen(order);
    markDishReady(order, b.id, 6000);
    expect(markDishReady(order, b.id, 8000).dish).toBeNull();
    expect(b.completedAt).toBe(6000);
    voidOrder(order);
    expect(markDishReady(order, f.id).dish).toBeNull();
  });

  it('recalling a dish clears its completion time and reopens a finished order', () => {
    const order = orderWith(emptyData(), 4, burger);
    const [b] = sendToKitchen(order);
    markDishReady(order, b.id);
    expect(recallDish(order, b.id)).toEqual({ dish: b, reopened: true });
    expect(b.completedAt).toBeNull();
    expect(order.status).toBe('open');
    expect(order.completedAt).toBeUndefined();
  });
});

describe('removing sent dishes', () => {
  it('takes cooking portions off the kitchen, newest first, but never served ones', () => {
    const order = orderWith(emptyData(), 1, burger, burger);
    const [first] = sendToKitchen(order, 1000); // 2× Burger
    markDishReady(order, first.id, 2000);
    addItem(order, burger);
    sendToKitchen(order, 3000); // 1× Burger cooking
    expect(cancelPending(order, order.lines[0].id, 2)).toBe(1);
    expect(order.dishes.map((d) => [d.qty, d.completedAt])).toEqual([[2, 2000]]);
  });

  it('completes the order when nothing is left cooking', () => {
    const order = orderWith(emptyData(), 1, burger, fries);
    const [b, f] = sendToKitchen(order);
    markDishReady(order, b.id);
    setLineQty(order, order.lines[1].id, 0);
    cancelPending(order, f.lineId, 1);
    expect(completeIfDone(order, 9000)).toBe(true);
    expect(order.completedAt).toBe(9000);
  });
});

describe('kitchen screen', () => {
  it('queues open orders with cooking dishes, oldest first', () => {
    const data = emptyData();
    const a = orderWith(data, 1, burger);
    const b = orderWith(data, 2, fries);
    sendToKitchen(b, 1000);
    sendToKitchen(a, 2000);
    orderWith(data, 3, fries); // nothing sent
    expect(kitchenQueue(data).map((g) => g.order.table)).toEqual([2, 1]);
    expect(pendingDishCount(data)).toBe(2);
    voidOrder(b);
    expect(pendingDishCount(data)).toBe(1);
  });

  it('lists dishes made ready recently, newest first', () => {
    const data = emptyData();
    const order = orderWith(data, 1, burger, fries);
    const [b, f] = sendToKitchen(order, 1000);
    markDishReady(order, b.id, 2000);
    markDishReady(order, f.id, 3000);
    expect(readyDishes(data, 0).map((r) => r.dish.name)).toEqual(['Fries', 'Burger']);
    expect(readyDishes(data, 2500)).toHaveLength(1);
  });

  it('colours dishes by how long they have been cooking', () => {
    const now = 100 * 60000;
    expect(dishUrgency({ orderedAt: now - 2 * 60000 }, now)).toBe('');
    expect(dishUrgency({ orderedAt: now - 10 * 60000 }, now)).toBe('mid');
    expect(dishUrgency({ orderedAt: now - 20 * 60000 }, now)).toBe('late');
    expect(dishUrgency({ orderedAt: 0, completedAt: 1 }, now)).toBe('done');
  });

  it('summarises each line for the order screen', () => {
    const order = orderWith(emptyData(), 1, burger, burger);
    const [b] = sendToKitchen(order);
    addItem(order, burger);
    sendToKitchen(order);
    addItem(order, burger);
    markDishReady(order, b.id);
    expect(lineKitchenStatus(order, order.lines[0])).toEqual({ unsent: 1, cooking: 1, ready: 2 });
  });
});
