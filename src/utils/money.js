/**
 * All money in the app is stored as integer cents so totals never drift.
 */

export function formatMoney(cents, currency = '', locale = undefined) {
  const amount = (Math.abs(cents) / 100).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cents < 0 ? '-' : ''}${currency}${amount}`;
}

/** Parse a user-typed amount ("12.5", "12.50") into cents. Invalid input becomes 0. */
export function parseCents(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Cents to a value suitable for an <input type="number">. */
export const centsToInput = (cents) => (cents / 100).toFixed(2);
