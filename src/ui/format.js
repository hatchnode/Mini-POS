import { CATEGORY_COLORS } from '../config.js';
import { store } from '../state/store.js';
import { formatMoney } from '../utils/money.js';

/** Format cents in the restaurant's currency. */
export const money = (cents) => formatMoney(cents, store.data.settings.currency);

export const categoryIndex = (id) => store.data.categories.findIndex((c) => c.id === id);

export function categoryColor(id) {
  const i = categoryIndex(id);
  return i < 0 ? 'var(--line)' : CATEGORY_COLORS[i % CATEGORY_COLORS.length];
}
