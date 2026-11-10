/**
 * Cash drawer. For each day the manager can note the opening float and, at closing, the cash
 * actually counted: `data.drawer[date] = { float, counted }` in cents. The app works out what
 * should be in the drawer (float + cash taken) and the difference.
 */
export const drawerEntry = (data, date) => data.drawer?.[date] || {};

export function setDrawer(data, date, patch) {
  data.drawer = { ...(data.drawer || {}), [date]: { ...drawerEntry(data, date), ...patch } };
}

/** `counted` and `difference` are null until the cash has been counted. */
export function drawerSummary(entry, cashSales) {
  const float = entry?.float || 0;
  const expected = float + cashSales;
  const counted = entry?.counted ?? null;
  return { float, cashSales, expected, counted, difference: counted == null ? null : counted - expected };
}
