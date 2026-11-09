/**
 * Tables are a list the staff manage: `data.tables = [{ id, name }]`.
 * Orders keep the table id plus a copy of its name (`order.table`, `order.tableName`),
 * so finished orders still read correctly after a table is renamed or removed.
 */
import { MAX_TABLES } from '../config.js';
import { uid } from '../utils/id.js';

/** "3" → "Table 3"; any other name ("Patio", "Bar 2") is shown as typed. */
export const tableLabel = (name) => (/^\d+$/.test(String(name)) ? `Table ${name}` : String(name));

export const findTable = (data, id) => data.tables.find((t) => t.id === id) || null;

export const isTableBusy = (data, tableId) =>
  data.orders.some((o) => o.status === 'open' && o.table === tableId);

const nameTaken = (data, name, exceptId) =>
  data.tables.some((t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase());

/** One more than the highest numbered table ("1" when there are none). */
export function nextTableName(data) {
  const numbers = data.tables.map((t) => Number(t.name)).filter((n) => Number.isInteger(n) && n > 0);
  return String((numbers.length ? Math.max(...numbers) : 0) + 1);
}

/** Add a table, named `name` or the next number. Returns { ok, table } or { ok: false, error }. */
export function addTable(data, name = '') {
  if (data.tables.length >= MAX_TABLES)
    return { ok: false, error: `You can have up to ${MAX_TABLES} tables` };
  const finalName = name.trim() || nextTableName(data);
  if (nameTaken(data, finalName))
    return { ok: false, error: `There is already a table called "${finalName}"` };
  const table = { id: uid(), name: finalName };
  data.tables.push(table);
  return { ok: true, table };
}

/** Rename a table and any open order sitting at it. */
export function renameTable(data, tableId, name) {
  const table = findTable(data, tableId);
  const finalName = name.trim();
  if (!table) return { ok: false, error: 'Table not found' };
  if (!finalName) return { ok: false, error: 'A table needs a name' };
  if (nameTaken(data, finalName, tableId)) {
    return { ok: false, error: `There is already a table called "${finalName}"` };
  }
  table.name = finalName;
  data.orders.forEach((o) => {
    if (o.status === 'open' && o.table === tableId) o.tableName = finalName;
  });
  return { ok: true, table };
}

/** Remove a free table. Tables with an open order can't be removed. */
export function removeTable(data, tableId) {
  const table = findTable(data, tableId);
  if (!table) return { ok: false, error: 'Table not found' };
  if (isTableBusy(data, tableId)) {
    return { ok: false, error: `${tableLabel(table.name)} has an open order. Finish or move it first.` };
  }
  data.tables = data.tables.filter((t) => t !== table);
  return { ok: true, table };
}

/** Tables 1..count, used for new data and for migrating the old "number of tables" setting. */
export const numberedTables = (count) =>
  Array.from({ length: count }, (_, i) => ({ id: `t${i + 1}`, name: String(i + 1) }));
