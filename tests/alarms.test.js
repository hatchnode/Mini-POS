import { describe, expect, it } from 'vitest';
import { servedAt, snoozeAlarm, unpaidAlarms } from '../src/domain/alarms.js';
import { markDishReady, sendToKitchen } from '../src/domain/kitchen.js';
import { addItem, createOrder } from '../src/domain/orders.js';
import { markPaid, markWalkout } from '../src/domain/payments.js';

const MIN = 60000;
const burger = { id: 'b', name: 'Burger', price: 1250 };
const fries = { id: 'f', name: 'Fries', price: 450 };

/** Table order with burger + fries sent at 0 and marked ready at the given minutes. */
function served(data, tableNo, readyAt = [5, 8]) {
  const order = createOrder(data, { id: `t${tableNo}`, name: String(tableNo) }, 0);
  addItem(order, burger);
  addItem(order, fries);
  sendToKitchen(order, 0).forEach((d, i) => markDishReady(order, d.id, readyAt[i] * MIN));
  return order;
}

describe('servedAt', () => {
  it('is when the last dish was marked ready', () => {
    const data = { orders: [], seq: 1 };
    expect(servedAt(served(data, 1, [5, 8]))).toBe(8 * MIN);
  });

  it('is null while anything is still cooking', () => {
    const data = { orders: [], seq: 1 };
    const order = createOrder(data, null, 0);
    addItem(order, burger);
    sendToKitchen(order, 0);
    expect(servedAt(order)).toBeNull();
  });
});

describe('unpaidAlarms', () => {
  it('fires once a served table has been unpaid for the set minutes', () => {
    const data = { orders: [], seq: 1 };
    const order = served(data, 1, [5, 8]); // served at 8 min
    expect(unpaidAlarms(data, 12 * MIN, 5)).toEqual([]);
    expect(unpaidAlarms(data, 13 * MIN, 5)).toEqual([{ order, since: 8 * MIN }]);
  });

  it('lists the longest-waiting table first', () => {
    const data = { orders: [], seq: 1 };
    const later = served(data, 1, [5, 9]);
    const earlier = served(data, 2, [2, 3]);
    expect(unpaidAlarms(data, 30 * MIN, 5).map((a) => a.order)).toEqual([earlier, later]);
  });

  it('stops once paid, walked out, or switched off', () => {
    const data = { orders: [], seq: 1 };
    const a = served(data, 1);
    const b = served(data, 2);
    expect(unpaidAlarms(data, 60 * MIN, 0)).toEqual([]);
    markPaid(a);
    markWalkout(b);
    expect(unpaidAlarms(data, 60 * MIN, 5)).toEqual([]);
  });

  it('can be snoozed for a while', () => {
    const data = { orders: [], seq: 1 };
    const order = served(data, 1, [5, 8]);
    snoozeAlarm(order, 20 * MIN, 10);
    expect(unpaidAlarms(data, 25 * MIN, 5)).toEqual([]);
    expect(unpaidAlarms(data, 30 * MIN, 5)).toHaveLength(1);
  });
});
