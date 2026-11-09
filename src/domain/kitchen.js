/**
 * Kitchen rules. Every dish line sent to the kitchen is tracked on its own:
 *
 *   dish = { id, lineId, name, qty, note, price, orderedAt, completedAt }
 *
 * `orderedAt` is when it was sent; `completedAt` is when the kitchen marked it ready (null while
 * cooking). "2× Burger" sent together is one dish. Dishes live on their order (`order.dishes`).
 * When every dish of an order is ready and nothing is waiting to be sent, the order completes.
 */
import { DISH_LATE_MINUTES, DISH_WARN_MINUTES } from '../config.js';
import { uid } from '../utils/id.js';
import { completeOrder, reopenOrder, unsentCount } from './orders.js';

export const dishesOf = (order) => order.dishes || [];
export const pendingDishes = (order) => dishesOf(order).filter((d) => !d.completedAt);
export const isInKitchen = (order) => pendingDishes(order).length > 0;
export const dishDuration = (d) => (d.completedAt && d.orderedAt ? d.completedAt - d.orderedAt : null);
const findDish = (order, dishId) => dishesOf(order).find((d) => d.id === dishId);

/** Send everything not yet sent. Each line becomes one dish. Returns the new dishes. */
export function sendToKitchen(order, now = Date.now()) {
  const fresh = order.lines
    .filter((l) => l.qty > l.sent)
    .map((l) => ({
      id: uid(),
      lineId: l.id,
      name: l.name,
      qty: l.qty - l.sent,
      note: l.note,
      price: l.price,
      orderedAt: now,
      completedAt: null,
    }));
  if (!fresh.length) return [];
  order.dishes = [...dishesOf(order), ...fresh];
  order.lines.forEach((l) => {
    l.sent = l.qty;
  });
  return fresh;
}

/** True when marking `dish` ready will complete its order. */
export function completesOrder(order, dish) {
  if (order.status !== 'open' || dish.completedAt) return false;
  return pendingDishes(order).every((d) => d === dish) && unsentCount(order) === 0;
}

/** Complete the order if the kitchen has nothing left for it. Returns true if it completed. */
export function completeIfDone(order, now = Date.now()) {
  if (order.status !== 'open' || !dishesOf(order).length) return false;
  if (isInKitchen(order) || unsentCount(order) > 0) return false;
  completeOrder(order, now);
  return true;
}

/** Mark one dish ready. Returns { dish, completed } where `completed` says the order finished. */
export function markDishReady(order, dishId, now = Date.now()) {
  const dish = findDish(order, dishId);
  if (!dish || dish.completedAt || order.status !== 'open') return { dish: null, completed: false };
  dish.completedAt = now;
  return { dish, completed: completeIfDone(order, now) };
}

/** Put a ready dish back in the kitchen. Reopens its order if that order had completed. */
export function recallDish(order, dishId) {
  const dish = findDish(order, dishId);
  if (!dish || order.status === 'void') return { dish: null, reopened: false };
  dish.completedAt = null;
  if (order.status !== 'completed') return { dish, reopened: false };
  reopenOrder(order);
  return { dish, reopened: true };
}

/**
 * Take `count` portions of a line off the kitchen screen, newest first, when staff remove
 * items that were already sent. Dishes already marked ready are left alone (they were served).
 */
export function cancelPending(order, lineId, count) {
  let left = count;
  const dishes = dishesOf(order);
  for (let i = dishes.length - 1; i >= 0 && left > 0; i--) {
    const d = dishes[i];
    if (d.lineId !== lineId || d.completedAt) continue;
    const take = Math.min(d.qty, left);
    d.qty -= take;
    left -= take;
  }
  order.dishes = dishes.filter((d) => d.qty > 0);
  return count - left;
}

/** Open orders with dishes cooking, each with its dishes oldest first; oldest order first. */
export function kitchenQueue(data) {
  return data.orders
    .filter((o) => o.status === 'open')
    .map((order) => ({ order, dishes: pendingDishes(order).sort((a, b) => a.orderedAt - b.orderedAt) }))
    .filter((g) => g.dishes.length)
    .sort((a, b) => a.dishes[0].orderedAt - b.dishes[0].orderedAt);
}

export const pendingDishCount = (data) => kitchenQueue(data).reduce((n, g) => n + g.dishes.length, 0);

/** Dishes marked ready since `since` (not on voided orders), newest first. */
export function readyDishes(data, since) {
  const out = [];
  for (const order of data.orders) {
    if (order.status === 'void') continue;
    for (const dish of dishesOf(order))
      if (dish.completedAt && dish.completedAt >= since) out.push({ order, dish });
  }
  return out.sort((a, b) => b.dish.completedAt - a.dish.completedAt);
}

/** '', 'mid', 'late' or 'done' for colouring a dish by how long it has been cooking. */
export function dishUrgency(dish, now = Date.now()) {
  if (dish.completedAt) return 'done';
  const mins = (now - dish.orderedAt) / 60000;
  if (mins > DISH_LATE_MINUTES) return 'late';
  if (mins > DISH_WARN_MINUTES) return 'mid';
  return '';
}

/** Per-line kitchen status for the order screen. */
export function lineKitchenStatus(order, line) {
  const dishes = dishesOf(order).filter((d) => d.lineId === line.id);
  const sum = (list) => list.reduce((n, d) => n + d.qty, 0);
  return {
    unsent: Math.max(0, line.qty - line.sent),
    cooking: sum(dishes.filter((d) => !d.completedAt)),
    ready: sum(dishes.filter((d) => d.completedAt)),
  };
}
