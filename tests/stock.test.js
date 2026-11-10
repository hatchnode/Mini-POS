import { describe, expect, it } from 'vitest';
import {
  isSoldOut,
  lowStockItems,
  parseStock,
  returnStock,
  returnUnsent,
  stockLevel,
  takeStock,
} from '../src/domain/stock.js';

describe('stock', () => {
  it('leaves untracked items alone', () => {
    const item = { id: 'a', name: 'Soup' };
    expect(takeStock(item, 5)).toBe(true);
    returnStock(item, 2);
    expect([item.stock, isSoldOut(item), stockLevel(item, 5)]).toEqual([undefined, false, null]);
  });

  it('counts down and refuses once sold out', () => {
    const item = { id: 'a', name: 'Cheesecake', stock: 2 };
    expect(takeStock(item)).toBe(true);
    expect(takeStock(item)).toBe(true);
    expect(isSoldOut(item)).toBe(true);
    expect(takeStock(item)).toBe(false);
    expect(item.stock).toBe(0);
    returnStock(item);
    expect(item.stock).toBe(1);
  });

  it('labels out, low and ok', () => {
    expect(stockLevel({ stock: 0 }, 5)).toBe('out');
    expect(stockLevel({ stock: 5 }, 5)).toBe('low');
    expect(stockLevel({ stock: 6 }, 5)).toBe('ok');
  });

  it('parses the stock box: blank means not tracked', () => {
    expect([parseStock(''), parseStock('  '), parseStock('12'), parseStock('3.9'), parseStock('-1')]).toEqual([
      null,
      null,
      12,
      3,
      null,
    ]);
    expect(parseStock('abc')).toBe(null);
  });

  it('lists low items on the menu, emptiest first', () => {
    const data = {
      items: [
        { id: 'a', name: 'A', active: true, stock: 3 },
        { id: 'b', name: 'B', active: true, stock: 0 },
        { id: 'c', name: 'C', active: true, stock: 40 },
        { id: 'd', name: 'D', active: false, stock: 1 },
        { id: 'e', name: 'E', active: true },
      ],
    };
    expect(lowStockItems(data, 5).map((i) => i.name)).toEqual(['B', 'A']);
  });

  it('gives back only what was never sent to the kitchen', () => {
    const data = { items: [{ id: 'a', name: 'A', stock: 1 }] };
    const order = { lines: [{ itemId: 'a', qty: 3, sent: 2 }, { itemId: 'gone', qty: 1, sent: 0 }] };
    returnUnsent(data, order);
    expect(data.items[0].stock).toBe(2);
  });
});
