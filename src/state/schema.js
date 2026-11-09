import { DEFAULT_SETTINGS, DEFAULT_TABLE_COUNT, SCHEMA_VERSION } from '../config.js';
import { numberedTables } from '../domain/tables.js';
import { uid } from '../utils/id.js';

const SAMPLE_CATEGORIES = [
  { id: 'c1', name: 'Mains' },
  { id: 'c2', name: 'Starters' },
  { id: 'c3', name: 'Drinks' },
  { id: 'c4', name: 'Desserts' },
];

const SAMPLE_ITEMS = [
  ['Classic Burger', 1250, 'c1'],
  ['Chicken Sandwich', 1150, 'c1'],
  ['Veggie Bowl', 1100, 'c1'],
  ['Fish & Chips', 1450, 'c1'],
  ['Pasta of the Day', 1300, 'c1'],
  ['Fries', 450, 'c2'],
  ['Soup of the Day', 600, 'c2'],
  ['Garden Salad', 750, 'c2'],
  ['Wings (6)', 900, 'c2'],
  ['Coffee', 300, 'c3'],
  ['Tea', 275, 'c3'],
  ['Soda', 250, 'c3'],
  ['Fresh Lemonade', 400, 'c3'],
  ['Beer', 650, 'c3'],
  ['House Wine', 800, 'c3'],
  ['Cheesecake', 650, 'c4'],
  ['Brownie Sundae', 700, 'c4'],
  ['Ice Cream', 450, 'c4'],
];

/** Fresh data with a sample menu. */
export function createSeedData() {
  return {
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    categories: SAMPLE_CATEGORIES.map((c) => ({ ...c })),
    items: SAMPLE_ITEMS.map(([name, price, catId]) => ({ id: uid(), name, price, catId, active: true })),
    tables: numberedTables(DEFAULT_TABLE_COUNT),
    orders: [],
    seq: 1,
  };
}

/**
 * v3: there is no payment step. Orders that were "paid" become "completed",
 * and `paidAt` becomes `completedAt`.
 */
function migrateOrder(order) {
  const o = { ...order };
  if (o.paidAt != null && o.completedAt == null) o.completedAt = o.paidAt;
  delete o.paidAt;
  if (o.status === 'paid') o.status = 'completed';
  return o;
}

/**
 * v4: kitchen work is tracked per dish on each order instead of as separate tickets.
 * Each old ticket line becomes a dish (sent time = ticket time, ready time = when the ticket was
 * marked done). Old tickets for finished orders may have been pruned, so anything else on a
 * completed or voided order is recorded as served when the order finished.
 */
function migrateDishes(order, tickets) {
  if (Array.isArray(order.dishes)) return order;
  const lines = order.lines || [];
  const findLine = (name, note) =>
    lines.find((l) => l.name === name && (l.note || '') === (note || '')) ||
    lines.find((l) => l.name === name);

  const dishes = tickets
    .filter((t) => t.orderId === order.id)
    .flatMap((t) =>
      (t.lines || []).map((tl) => {
        const line = findLine(tl.name, tl.note);
        return {
          id: uid(),
          lineId: line?.id ?? null,
          name: tl.name,
          qty: tl.qty,
          note: tl.note || '',
          price: line?.price ?? 0,
          orderedAt: t.createdAt,
          completedAt: t.done ? t.doneAt || t.createdAt : null,
        };
      }),
    );

  if (order.status !== 'open') {
    const finishedAt = order.completedAt ?? order.voidedAt ?? order.createdAt;
    for (const l of lines) {
      const covered = dishes.filter((d) => d.lineId === l.id).reduce((n, d) => n + d.qty, 0);
      const missing = l.qty - covered;
      if (missing > 0) {
        dishes.push({
          id: uid(),
          lineId: l.id,
          name: l.name,
          qty: missing,
          note: l.note || '',
          price: l.price,
          orderedAt: order.createdAt ?? finishedAt,
          completedAt: finishedAt,
        });
      }
    }
  }
  return { ...order, dishes };
}

/**
 * v5: tables are a managed list instead of a count. The old "number of tables" setting becomes
 * tables 1..n, and orders switch from a table number to that table's id plus its name.
 */
function migrateTable(order) {
  if (typeof order.table !== 'number') return order;
  return { ...order, table: `t${order.table}`, tableName: String(order.table) };
}

/** Bring stored or imported data up to the current schema. */
export function migrate(raw) {
  const data = { ...raw };
  const settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  delete settings.taxRate; // v2: tax removed
  const tableCount = Number.isInteger(settings.tables) ? settings.tables : DEFAULT_TABLE_COUNT;
  delete settings.tables; // v5: replaced by data.tables
  data.settings = settings;
  data.tables = Array.isArray(raw.tables) ? raw.tables : numberedTables(tableCount);
  data.categories = Array.isArray(raw.categories) ? raw.categories : [];
  data.items = Array.isArray(raw.items) ? raw.items : [];
  const tickets = Array.isArray(raw.tickets) ? raw.tickets : [];
  data.orders = Array.isArray(raw.orders)
    ? raw.orders.map((o) => migrateTable(migrateDishes(migrateOrder(o), tickets)))
    : [];
  delete data.tickets; // v4: replaced by order.dishes
  data.seq = Number(raw.seq) || 1;
  data.version = SCHEMA_VERSION;
  return data;
}

/** True when an object looks like a Mini-POS backup. */
export const isBackup = (raw) => !!raw && Array.isArray(raw.items) && Array.isArray(raw.categories);
