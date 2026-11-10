import { describe, expect, it } from 'vitest';
import { BACKUP_TABLES, backupFiles, dataFromFiles, fromTables, toTables } from '../src/domain/backup.js';
import { addCustomer, attachCustomer, redeemReward } from '../src/domain/customers.js';
import { setDrawer } from '../src/domain/drawer.js';
import { markDishReady, sendToKitchen } from '../src/domain/kitchen.js';
import { logEvent } from '../src/domain/log.js';
import { addItem, createOrder, setLineNote, voidOrder } from '../src/domain/orders.js';
import { markPaid, markWalkout } from '../src/domain/payments.js';
import { addStaff } from '../src/domain/staff.js';
import { createSeedData, migrate } from '../src/state/schema.js';
import { parseCsv, toCsv } from '../src/utils/file.js';
import { crc32, unzipFiles, zipFiles } from '../src/utils/zip.js';

/** A busy restaurant: every kind of record and every order state. */
function busyData() {
  const data = createSeedData();
  data.settings.name = 'Café "Ñandú", est. 1999';
  data.settings.otherPayments = ['Voucher'];
  const [burger, sandwich, , , , fries] = data.items;
  burger.stock = 4;
  sandwich.active = false;
  data.items.push({ id: 'x', name: 'Loose item', price: 99, catId: null, active: true });
  addStaff(data, { name: 'Ana', pin: '1234' });
  const mia = addCustomer(data, { name: 'Mia, "the regular"', phone: '555-0101' }, 500).customer;

  const served = createOrder(data, data.tables[0], 1000, 'Ana');
  attachCustomer(served, mia);
  addItem(served, burger);
  addItem(served, burger);
  addItem(served, fries);
  setLineNote(served, served.lines[1].id, 'No salt,\nextra "crispy"');
  redeemReward(served, mia, 'Free drink');
  sendToKitchen(served, 2000).forEach((d) => markDishReady(served, d.id, 3000));
  markPaid(served, 4000, { method: 'Cash', staff: 'Ana' });

  const open = createOrder(data, null, 5000);
  addItem(open, fries);
  sendToKitchen(open, 5500);
  addItem(open, burger);
  markPaid(open, 6000, { method: 'Voucher' });
  addItem(open, fries);

  const walked = createOrder(data, data.tables[1], 7000);
  addItem(walked, burger);
  sendToKitchen(walked, 7100).forEach((d) => markDishReady(walked, d.id, 7200));
  markWalkout(walked, 8000);

  const voided = createOrder(data, data.tables[2], 9000);
  addItem(voided, fries);
  voidOrder(voided, 9500);

  // A bill from before payments were recorded, with tax and a tip.
  data.orders.push({
    id: 'old',
    no: 99,
    table: 't4',
    tableName: '4',
    status: 'completed',
    createdAt: 100,
    completedAt: 200,
    paidAt: 200,
    paidAmount: 1100,
    totals: { subtotal: 1000, discount: 0, tax: 80, tip: 20, total: 1100 },
    lines: [{ id: 'l', itemId: 'gone', name: 'Old dish', price: 1000, qty: 1, sent: 1, note: '' }],
    dishes: [],
    alarmSnoozedUntil: 12345,
  });
  setDrawer(data, '2026-03-10', { float: 10000 });
  setDrawer(data, '2026-03-11', { float: 5000, counted: 20050 });
  logEvent(data, 'void', 'Voided Table 3 #4 ($4.50)', 'Ana', 9500);
  logEvent(data, 'staff', 'Sign-in was reset', null, 9600);
  data.lastBackupAt = 1700000000000;
  return data;
}

describe('CSV backup', () => {
  it('restores exactly what was saved', () => {
    const data = busyData();
    expect(migrate(fromTables(toTables(data)))).toEqual(data);
  });

  it('survives being written to CSV text and read back', () => {
    const data = busyData();
    const result = dataFromFiles(backupFiles(data, 1800000000000));
    expect(result.ok).toBe(true);
    expect(result.savedAt).toBe(1800000000000);
    expect(migrate(result.data)).toEqual(data);
  });

  it('writes one readable file per kind of record', () => {
    const files = backupFiles(busyData());
    expect(files.map((f) => f.name)).toEqual(BACKUP_TABLES.map((t) => `${t}.csv`));
    const items = parseCsv(files.find((f) => f.name === 'items.csv').text);
    expect(items[0]).toEqual(['id', 'name', 'price', 'category_id', 'on_menu', 'stock_left', 'extra']);
    expect(items[1].slice(1)).toEqual(['Classic Burger', '12.50', 'c1', 'true', '4', '']);
    const orders = parseCsv(files.find((f) => f.name === 'orders.csv').text);
    expect(orders[1].slice(1, 6)).toEqual(['1', 't1', '1', 'completed', '1970-01-01T00:00:01.000Z']);
  });

  it('reads a file edited in a spreadsheet: columns moved, extra column dropped', () => {
    const csv = 'name,price,id,on_menu\r\nTea,2.75,i1,TRUE\r\n"Pie, apple",4,i2,false\r\n';
    const result = dataFromFiles([
      { name: 'Items.CSV', text: csv },
      { name: 'categories.csv', text: 'id,name\nc1,Drinks\n' },
      { name: 'notes.txt', text: 'ignored' },
    ]);
    expect(result.ok).toBe(true);
    const data = migrate(result.data);
    expect(data.items).toEqual([
      { id: 'i1', name: 'Tea', price: 275, catId: null, active: true },
      { id: 'i2', name: 'Pie, apple', price: 400, catId: null, active: false },
    ]);
    expect([data.orders, data.seq, data.tables.length]).toEqual([[], 1, 12]);
  });

  it('refuses files that are not a backup', () => {
    expect(dataFromFiles([{ name: 'sales.csv', text: 'a,b\n1,2' }]).ok).toBe(false);
    expect(dataFromFiles([]).ok).toBe(false);
  });
});

describe('parseCsv', () => {
  it('round-trips awkward cells', () => {
    const rows = [
      ['plain', 'with, comma', 'with "quotes"', 'two\nlines', ''],
      ['', 'ünïcödé', ' padded ', '', 'last'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    expect(parseCsv(`\ufeff${toCsv(rows)}\r\n`)).toEqual(rows);
  });

  it('skips blank lines and handles a missing final newline', () => {
    expect(parseCsv('a,b\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('')).toEqual([]);
  });
});

describe('zip', () => {
  it('matches the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('packs files and reads them back', async () => {
    const files = [
      { name: 'items.csv', text: 'id,name\n1,Café ☕\n' },
      { name: 'empty.csv', text: '' },
    ];
    expect(await unzipFiles(zipFiles(files))).toEqual(files);
  });

  it('rejects something that is not a ZIP', async () => {
    await expect(
      unzipFiles(new TextEncoder().encode('just some text, not a zip file at all')),
    ).rejects.toThrow();
  });
});
