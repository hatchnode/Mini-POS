/**
 * The app's data as a set of CSV files, one per kind of record, and back again. The same files
 * are used for the downloadable backup and for the data folder on the computer.
 *
 *   about.csv        what the files are, data version, next order number, when saved
 *   settings.csv     one row per setting
 *   categories.csv, items.csv, tables.csv
 *   orders.csv       one row per bill; its lines, dishes and payments are in
 *   order_lines.csv, dishes.csv, payments.csv   (linked by order_id)
 *   customers.csv, staff.csv, drawer.csv, log.csv
 *
 * Money is written as decimal amounts (12.50) and times as ISO dates, so the files read well in a
 * spreadsheet. Anything that doesn't fit a column goes into that row's `extra` column as JSON, so
 * nothing is lost when a backup is restored.
 */
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../config.js';
import { parseCsv, toCsv } from '../utils/file.js';

/** What a blank cell means for a column: the field is missing, null, or an empty string. */
const BLANK = { absent: undefined, null: null, empty: '' };

const TYPES = {
  str: { fits: (v) => typeof v === 'string' && v !== '', write: (v) => v, read: (s) => s },
  num: { fits: (v) => typeof v === 'number' && Number.isFinite(v), write: String, read: Number },
  money: {
    fits: (v) => Number.isInteger(v),
    write: (v) => (v / 100).toFixed(2),
    read: (s) => Math.round(parseFloat(s) * 100),
  },
  time: {
    fits: (v) => Number.isInteger(v) && Math.abs(v) < 8.64e15,
    write: (v) => new Date(v).toISOString(),
    read: (s) => Date.parse(s),
  },
  bool: { fits: (v) => typeof v === 'boolean', write: String, read: (s) => /^(true|yes|1)$/i.test(s.trim()) },
};

const col = (header, field, type = 'str', blank = 'absent') => ({ header, field, type, blank });
const EXTRA = 'extra';

const COLUMNS = {
  categories: [col('id', 'id'), col('name', 'name', 'str', 'empty')],
  items: [
    col('id', 'id'),
    col('name', 'name', 'str', 'empty'),
    col('price', 'price', 'money'),
    col('category_id', 'catId', 'str', 'null'),
    col('on_menu', 'active', 'bool'),
    col('stock_left', 'stock', 'num'),
  ],
  tables: [col('id', 'id'), col('name', 'name', 'str', 'empty')],
  orders: [
    col('id', 'id'),
    col('number', 'no', 'num'),
    col('table_id', 'table', 'str', 'null'),
    col('table_name', 'tableName', 'str', 'null'),
    col('status', 'status'),
    col('created_at', 'createdAt', 'time'),
    col('completed_at', 'completedAt', 'time'),
    col('voided_at', 'voidedAt', 'time'),
    col('paid_at', 'paidAt', 'time'),
    col('paid_amount', 'paidAmount', 'money'),
    col('total', 'total', 'money'),
    col('staff', 'staff'),
    col('customer_id', 'customerId'),
    col('customer_name', 'customerName'),
  ],
  order_lines: [
    col('order_id', 'orderId'),
    col('id', 'id'),
    col('item_id', 'itemId', 'str', 'null'),
    col('name', 'name', 'str', 'empty'),
    col('price', 'price', 'money'),
    col('qty', 'qty', 'num'),
    col('sent_to_kitchen', 'sent', 'num'),
    col('note', 'note', 'str', 'empty'),
    col('reward', 'reward', 'bool'),
  ],
  dishes: [
    col('order_id', 'orderId'),
    col('id', 'id'),
    col('line_id', 'lineId', 'str', 'null'),
    col('name', 'name', 'str', 'empty'),
    col('qty', 'qty', 'num'),
    col('note', 'note', 'str', 'empty'),
    col('price', 'price', 'money'),
    col('ordered_at', 'orderedAt', 'time'),
    col('completed_at', 'completedAt', 'time', 'null'),
  ],
  payments: [
    col('order_id', 'orderId'),
    col('paid_at', 'at', 'time'),
    col('amount', 'amount', 'money'),
    col('method', 'method', 'str', 'null'),
    col('staff', 'staff'),
  ],
  customers: [
    col('id', 'id'),
    col('name', 'name', 'str', 'empty'),
    col('phone', 'phone', 'str', 'empty'),
    col('created_at', 'createdAt', 'time'),
    col('rewards_redeemed', 'redeemed', 'num'),
  ],
  staff: [col('id', 'id'), col('name', 'name'), col('role', 'role'), col('pin_scrambled', 'pin')],
  drawer: [
    col('date', 'date'),
    col('opening_float', 'float', 'money'),
    col('cash_counted', 'counted', 'money'),
  ],
  log: [
    col('id', 'id'),
    col('at', 'at', 'time'),
    col('type', 'type'),
    col('what', 'text', 'str', 'empty'),
    col('who', 'staff', 'str', 'null'),
  ],
};

/** The files of a backup, in the order they are written. */
export const BACKUP_TABLES = ['about', 'settings', ...Object.keys(COLUMNS)];
export const fileName = (table) => `${table}.csv`;

function writeRows(table, records) {
  const columns = COLUMNS[table];
  const known = new Set(columns.map((c) => c.field));
  const rows = records.map((record) => {
    const extra = {};
    const absent = [];
    const cells = columns.map((c) => {
      const value = record[c.field];
      if (value === BLANK[c.blank]) return '';
      if (TYPES[c.type].fits(value)) return TYPES[c.type].write(value);
      // Doesn't fit the column (e.g. null where a blank means "missing"): keep it exactly in `extra`.
      if (value === undefined) absent.push(c.field);
      else extra[c.field] = value;
      return '';
    });
    for (const [key, value] of Object.entries(record)) {
      if (!known.has(key) && value !== undefined) extra[key] = value;
    }
    if (absent.length) extra._absent = absent;
    return [...cells, Object.keys(extra).length ? JSON.stringify(extra) : ''];
  });
  return [[...columns.map((c) => c.header), EXTRA], ...rows];
}

function readRows(table, rows) {
  if (!rows?.length) return [];
  const index = Object.fromEntries(rows[0].map((h, i) => [h.trim().toLowerCase(), i]));
  return rows.slice(1).map((cells) => {
    const record = {};
    for (const c of COLUMNS[table]) {
      const cell = cells[index[c.header]] ?? '';
      if (cell === '') {
        if (c.blank !== 'absent') record[c.field] = BLANK[c.blank];
        continue;
      }
      const value = TYPES[c.type].read(cell);
      if (!Number.isNaN(value)) record[c.field] = value;
    }
    const extraCell = cells[index[EXTRA]] ?? '';
    if (extraCell) {
      const { _absent = [], ...extra } = JSON.parse(extraCell);
      Object.assign(record, extra);
      _absent.forEach((field) => delete record[field]);
    }
    return record;
  });
}

/** Settings as key/value rows. Text is written as it is; numbers, switches and lists as JSON. */
const settingRows = (settings) => [
  ['setting', 'value'],
  ...Object.entries(settings).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : JSON.stringify(value),
  ]),
];

function readSettings(rows) {
  const settings = {};
  for (const [key, value = ''] of (rows || []).slice(1)) {
    if (typeof DEFAULT_SETTINGS[key] === 'string') settings[key] = value;
    else {
      try {
        settings[key] = JSON.parse(value);
      } catch {
        settings[key] = value;
      }
    }
  }
  return settings;
}

const isPlainTotal = (totals) =>
  !!totals &&
  Object.keys(totals).length === 2 &&
  Number.isInteger(totals.total) &&
  totals.subtotal === totals.total;

/** All data as tables of rows: `{ items: [[header…], [cells…], …], … }`. */
export function toTables(data, now = Date.now()) {
  const orders = [];
  const lines = [];
  const dishes = [];
  const payments = [];
  for (const order of data.orders || []) {
    // eslint-disable-next-line no-unused-vars
    const { lines: l, dishes: d, payments: p, totals, ...row } = order;
    // The frozen bill total gets its own column; older bills with tax or tips keep theirs in `extra`.
    if (isPlainTotal(totals)) row.total = totals.total;
    else if (totals) row.totals = totals;
    orders.push(row);
    (order.lines || []).forEach((x) => lines.push({ orderId: order.id, ...x }));
    (order.dishes || []).forEach((x) => dishes.push({ orderId: order.id, ...x }));
    (order.payments || []).forEach((x) => payments.push({ orderId: order.id, ...x }));
  }
  const drawer = Object.entries(data.drawer || {}).map(([date, entry]) => {
    const row = { date };
    if (entry.float != null) row.float = entry.float;
    if (entry.counted != null) row.counted = entry.counted;
    return row;
  });
  const iso = (ts) => (ts ? new Date(ts).toISOString() : '');
  return {
    about: [
      ['about', 'value'],
      ['app', 'Mini-POS'],
      ['data_version', String(data.version ?? SCHEMA_VERSION)],
      ['next_order_number', String(data.seq ?? 1)],
      ['saved_at', iso(now)],
      ['last_backup_at', iso(data.lastBackupAt)],
    ],
    settings: settingRows(data.settings || {}),
    categories: writeRows('categories', data.categories || []),
    items: writeRows('items', data.items || []),
    tables: writeRows('tables', data.tables || []),
    orders: writeRows('orders', orders),
    order_lines: writeRows('order_lines', lines),
    dishes: writeRows('dishes', dishes),
    payments: writeRows('payments', payments),
    customers: writeRows('customers', data.customers || []),
    staff: writeRows('staff', data.staff || []),
    drawer: writeRows('drawer', drawer),
    log: writeRows('log', data.log || []),
  };
}

/** Rebuild the data from tables of rows. The result still goes through `migrate`. */
export function fromTables(tables) {
  const about = Object.fromEntries((tables.about || []).slice(1).map(([k, v]) => [k, v]));
  const orders = readRows('orders', tables.orders).map(({ total, ...order }) => {
    if (total !== undefined && !order.totals) order.totals = { subtotal: total, total };
    return { ...order, lines: [], dishes: [] };
  });
  const byId = new Map(orders.map((o) => [o.id, o]));
  const attach = (table, add) => {
    for (const { orderId, ...record } of readRows(table, tables[table])) {
      const order = byId.get(orderId);
      if (order) add(order, record);
    }
  };
  attach('order_lines', (o, r) => o.lines.push(r));
  attach('dishes', (o, r) => o.dishes.push(r));
  attach('payments', (o, r) => (o.payments ||= []).push(r));

  const data = {
    version: Number(about.data_version) || 1,
    settings: readSettings(tables.settings),
    categories: readRows('categories', tables.categories),
    items: readRows('items', tables.items),
    orders,
    seq: Number(about.next_order_number) || orders.reduce((n, o) => Math.max(n, o.no || 0), 0) + 1,
    customers: readRows('customers', tables.customers),
    staff: readRows('staff', tables.staff),
    drawer: Object.fromEntries(readRows('drawer', tables.drawer).map(({ date, ...entry }) => [date, entry])),
    log: readRows('log', tables.log),
  };
  // No tables file (e.g. a hand-made menu import): leave tables out so the defaults apply.
  if (tables.tables) data.tables = readRows('tables', tables.tables);
  const lastBackupAt = Date.parse(about.last_backup_at);
  if (!Number.isNaN(lastBackupAt)) data.lastBackupAt = lastBackupAt;
  return data;
}

/** The backup as files: `[{ name: 'items.csv', text }]`. The leading mark makes Excel read accents correctly. */
export function backupFiles(data, now = Date.now()) {
  const tables = toTables(data, now);
  return BACKUP_TABLES.map((table) => ({ name: fileName(table), text: `\ufeff${toCsv(tables[table])}\n` }));
}

/**
 * Read a backup from files `[{ name, text }]` (other files are ignored).
 * Returns { ok, data, savedAt } or { ok: false, error }.
 */
export function dataFromFiles(files) {
  const tables = {};
  for (const file of files) {
    const table = file.name.toLowerCase().replace(/\.csv$/, '');
    if (BACKUP_TABLES.includes(table)) tables[table] = parseCsv(file.text);
  }
  const missing = ['items', 'categories'].filter((t) => !tables[t]?.length);
  if (missing.length) {
    return { ok: false, error: `Not a Mini-POS backup: ${missing.map(fileName).join(' and ')} missing` };
  }
  try {
    const about = Object.fromEntries((tables.about || []).slice(1));
    const savedAt = Date.parse(about.saved_at);
    return { ok: true, data: fromTables(tables), savedAt: Number.isNaN(savedAt) ? null : savedAt };
  } catch {
    return { ok: false, error: 'One of the backup files is damaged and could not be read' };
  }
}
