/**
 * Unpaid alarm: a served table that still hasn't paid after a few minutes is the classic
 * walk-out moment. These rules decide which orders should alarm; the UI makes them impossible to
 * miss (flashing table, banner on every screen, sound).
 */
import { dishesOf, isServed } from './kitchen.js';
import { isPaid } from './orders.js';

/** When the order was fully served (its last dish marked ready), or null if not served. */
export function servedAt(order) {
  if (!isServed(order)) return null;
  return Math.max(...dishesOf(order).map((d) => d.completedAt || 0));
}

/**
 * Open orders that are served, unpaid and have been waiting at least `minutes`, oldest first.
 * Snoozed orders are skipped until their snooze ends. `minutes` of 0 turns the alarm off.
 */
export function unpaidAlarms(data, now, minutes) {
  if (!minutes || minutes <= 0) return [];
  return data.orders
    .filter((o) => o.status === 'open' && !isPaid(o) && isServed(o))
    .map((order) => ({ order, since: servedAt(order) }))
    .filter(({ order, since }) => now - since >= minutes * 60000 && !(order.alarmSnoozedUntil > now))
    .sort((a, b) => a.since - b.since);
}

/** Silence one order's alarm for a while (e.g. the customer is still eating dessert). */
export function snoozeAlarm(order, now, minutes) {
  order.alarmSnoozedUntil = now + minutes * 60000;
}
