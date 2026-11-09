import { describe, expect, it } from 'vitest';
import { addItem, createOrder, orderLabel } from '../src/domain/orders.js';
import {
  addTable,
  isTableBusy,
  nextTableName,
  numberedTables,
  removeTable,
  renameTable,
  tableLabel,
} from '../src/domain/tables.js';

const data = (count = 3) => ({ tables: numberedTables(count), orders: [], seq: 1 });

describe('tableLabel', () => {
  it('prefixes numbers with "Table" and shows other names as typed', () => {
    expect(tableLabel('7')).toBe('Table 7');
    expect(tableLabel('Patio')).toBe('Patio');
    expect(tableLabel('Bar 2')).toBe('Bar 2');
  });
});

describe('adding tables', () => {
  it('numbers the next table after the highest one', () => {
    const d = data(3);
    expect(nextTableName(d)).toBe('4');
    const { ok, table } = addTable(d);
    expect(ok).toBe(true);
    expect(table.name).toBe('4');
    expect(d.tables).toHaveLength(4);
  });

  it('starts at 1 and ignores named tables when numbering', () => {
    const d = { tables: [{ id: 'p', name: 'Patio' }], orders: [] };
    expect(addTable(d).table.name).toBe('1');
  });

  it('accepts a custom name but not a duplicate', () => {
    const d = data(2);
    expect(addTable(d, 'Patio').ok).toBe(true);
    expect(addTable(d, 'patio')).toEqual({ ok: false, error: 'There is already a table called "patio"' });
  });
});

describe('renaming tables', () => {
  it('renames the table and the open order sitting at it', () => {
    const d = data(2);
    const order = createOrder(d, d.tables[0]);
    expect(renameTable(d, 't1', ' Window ').ok).toBe(true);
    expect(d.tables[0].name).toBe('Window');
    expect(orderLabel(order)).toBe('Window');
  });

  it('rejects empty and duplicate names', () => {
    const d = data(2);
    expect(renameTable(d, 't1', '  ').ok).toBe(false);
    expect(renameTable(d, 't1', '2').ok).toBe(false);
    expect(renameTable(d, 't1', '1').ok).toBe(true); // its own name is fine
  });
});

describe('removing tables', () => {
  it('removes a free table', () => {
    const d = data(3);
    expect(removeTable(d, 't2').ok).toBe(true);
    expect(d.tables.map((t) => t.name)).toEqual(['1', '3']);
  });

  it('refuses to remove a table with an open order', () => {
    const d = data(3);
    const order = createOrder(d, d.tables[1]);
    addItem(order, { id: 'f', name: 'Fries', price: 450 });
    expect(isTableBusy(d, 't2')).toBe(true);
    expect(removeTable(d, 't2')).toEqual({
      ok: false,
      error: 'Table 2 has an open order. Finish or move it first.',
    });
    order.status = 'completed';
    expect(removeTable(d, 't2').ok).toBe(true);
  });

  it('keeps finished orders readable after their table is removed', () => {
    const d = data(2);
    const order = createOrder(d, d.tables[0]);
    order.status = 'completed';
    removeTable(d, 't1');
    expect(orderLabel(order)).toBe('Table 1');
  });
});
