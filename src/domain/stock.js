/**
 * Stock. An item can carry a count of portions left (`item.stock`); items without a count are
 * not tracked and can always be sold. The count goes down when an item is added to an order and
 * comes back only if it is removed before being sent to the kitchen: once the kitchen has it, the
 * food counts as used. At zero the item is sold out and can't be ordered.
 */
export const isTracked = (item) => Number.isInteger(item?.stock);
export const isSoldOut = (item) => isTracked(item) && item.stock <= 0;

/** null (not tracked), 'out', 'low' or 'ok'. */
export function stockLevel(item, lowAt = 0) {
  if (!isTracked(item)) return null;
  if (item.stock <= 0) return 'out';
  return item.stock <= lowAt ? 'low' : 'ok';
}

/** Take `n` portions. Returns false (and takes nothing) when there aren't enough left. */
export function takeStock(item, n = 1) {
  if (!isTracked(item)) return true;
  if (item.stock < n) return false;
  item.stock -= n;
  return true;
}

export function returnStock(item, n = 1) {
  if (isTracked(item) && n > 0) item.stock += n;
}

/** What staff typed in the stock box: blank means "don't track", otherwise a whole number ≥ 0. */
export function parseStock(value) {
  const text = String(value ?? '').trim();
  if (text === '') return null;
  const n = Math.floor(Number(text));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Items on the menu that are sold out or running low, emptiest first. */
export const lowStockItems = (data, lowAt = 0) =>
  data.items.filter((i) => i.active && isTracked(i) && i.stock <= lowAt).sort((a, b) => a.stock - b.stock);

/** Give back the portions of an order that were never sent to the kitchen (when it is voided). */
export function returnUnsent(data, order) {
  for (const line of order.lines) {
    const item = data.items.find((i) => i.id === line.itemId);
    returnStock(item, Math.max(0, line.qty - line.sent));
  }
}
