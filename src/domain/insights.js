/**
 * Trends over the last week or month, for the owner: how sales compare with the period before,
 * which days and hours are busiest, what sells and what doesn't. Built on the same paid-bills
 * rules as the daily Sales figures.
 */
import { POPULAR_DAYS, POPULAR_LIMIT } from '../config.js';
import { dayRange, shiftDate, todayStr } from '../utils/date.js';
import { billTotal } from './orders.js';
import { paymentStatus } from './payments.js';
import { summarizeSales } from './sales.js';

/** The last `days` days ending today, as a list of YYYY-MM-DD dates (oldest first). */
export function periodDates(days, now = Date.now()) {
  const today = todayStr(new Date(now));
  return Array.from({ length: days }, (_, i) => shiftDate(today, i - days + 1));
}

const rangeOf = (dates) => [dayRange(dates[0])[0], dayRange(dates[dates.length - 1])[1]];

export function summarizeTrends(data, days, now = Date.now()) {
  const dates = periodDates(days, now);
  const previousDates = dates.map((d) => shiftDate(d, -days));
  const current = summarizeSales(data.orders, rangeOf(dates));
  const previous = summarizeSales(data.orders, rangeOf(previousDates));

  const totals = Object.fromEntries(dates.map((d) => [d, { date: d, total: 0, bills: 0 }]));
  for (const o of current.bills) {
    const day = paymentStatus(o) === 'paid' && totals[todayStr(new Date(o.paidAt))];
    if (!day) continue;
    day.total += billTotal(o);
    day.bills += 1;
  }
  const byDay = Object.values(totals);
  const bestDay = byDay.reduce((best, d) => (d.total > (best?.total || 0) ? d : best), null);
  const hours = Object.entries(current.byHour).sort((a, b) => b[1] - a[1]);

  // Items on the menu that nobody bought in the period: candidates to promote, reprice or drop.
  const sold = new Set(current.items.map((i) => i.name));
  const notSelling = data.items.filter((i) => i.active && !sold.has(i.name));

  return {
    days,
    current,
    previousTotal: previous.total,
    /** Change against the period before as a fraction (0.25 = up 25%), or null with nothing to compare. */
    change: previous.total ? (current.total - previous.total) / previous.total : null,
    byDay,
    bestDay,
    busiestHour: hours.length ? Number(hours[0][0]) : null,
    notSelling,
  };
}

/**
 * Ids of the best-selling menu items over the last `days` days, best first, for the "Popular" tab.
 * Counts everything ordered (except on voided orders) for items still on the menu.
 */
export function popularItemIds(data, now = Date.now(), days = POPULAR_DAYS, limit = POPULAR_LIMIT) {
  const since = now - days * 86400000;
  const onMenu = new Set(data.items.filter((i) => i.active).map((i) => i.id));
  const counts = new Map();
  for (const o of data.orders) {
    if (o.status === 'void' || !(o.createdAt >= since)) continue;
    for (const l of o.lines) {
      if (onMenu.has(l.itemId)) counts.set(l.itemId, (counts.get(l.itemId) || 0) + l.qty);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
