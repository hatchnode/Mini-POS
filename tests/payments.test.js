import { describe, expect, it } from 'vitest';
import { completePayment, quickTenderOptions, tipFromPercent } from '../src/domain/payments.js';

const order = () => ({
  lines: [{ price: 3600, qty: 1 }],
  discount: { type: 'pct', value: 10 },
  tip: 0,
  status: 'open',
});

describe('quickTenderOptions', () => {
  it('offers exact plus the next round amounts, without duplicates', () => {
    expect(quickTenderOptions(3985)).toEqual([3985, 4000, 5000, 10000]);
  });
  it('handles an already-round total', () => {
    expect(quickTenderOptions(2000)).toEqual([2000, 5000, 10000]);
  });
});

describe('tipFromPercent', () => {
  it('is calculated after the discount', () => {
    expect(tipFromPercent(order(), 15)).toBe(486); // 15% of 32.40
  });
});

describe('completePayment', () => {
  it('rejects cash below the total', () => {
    const o = order();
    expect(completePayment(o, { method: 'cash', tendered: 1000 }).ok).toBe(false);
    expect(o.status).toBe('open');
  });

  it('records cash change and freezes totals', () => {
    const o = order();
    o.tip = 486;
    expect(completePayment(o, { method: 'cash', tendered: 5000 }, 123).ok).toBe(true);
    expect(o.status).toBe('paid');
    expect(o.paidAt).toBe(123);
    expect(o.totals.total).toBe(3726);
    expect(o.payment).toEqual({ method: 'cash', tendered: 5000, change: 1274 });
  });

  it('treats card as paying the exact total', () => {
    const o = order();
    completePayment(o, { method: 'card' });
    expect(o.payment).toEqual({ method: 'card', tendered: 3240, change: 0 });
  });
});
