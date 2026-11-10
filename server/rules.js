/**
 * What a device may change. These checks run on the server for every change a device sends, so
 * they hold no matter what the app in the browser does.
 *
 * `who` describes the device's session:
 *   open      no staff are set up: anyone on a connected device may do anything
 *   manager   a manager is signed in, or a manager approved this request with their PIN
 *   staff     a staff member is signed in
 *   none      staff are set up but nobody is signed in on this device
 *
 * Returns null when the change is allowed, otherwise the reason it is refused.
 */
const MANAGER_ONLY = new Set(['settings', 'categories', 'tables', 'drawer']);
export const LOG_LIMIT = 500;

const sentQty = (order) => new Map((order?.lines || []).map((l) => [l.id, l.sent || 0]));

/** True when the new version of an order removes portions the kitchen had already been sent. */
function removesSentDishes(before, after) {
  const now = new Map((after?.lines || []).map((l) => [l.id, l.qty || 0]));
  for (const [lineId, sent] of sentQty(before)) {
    if (sent > 0 && (now.get(lineId) ?? 0) < sent) return true;
  }
  return false;
}

/** Same record apart from the listed fields? */
function sameExcept(before, after, fields) {
  const strip = (doc) => {
    const copy = { ...doc };
    fields.forEach((f) => delete copy[f]);
    return JSON.stringify(Object.entries(copy).sort(([a], [b]) => (a < b ? -1 : 1)));
  };
  return strip(before) === strip(after);
}

export function checkChange(who, collection, id, before, after, { logCount = 0 } = {}) {
  // Staff accounts and PINs are changed only through the staff endpoints, never by syncing.
  if (collection === 'staff') return 'Staff are managed on the server';

  // The activity log is a record of what happened: entries can be added, not rewritten. Old
  // entries may be dropped once the log is full.
  if (collection === 'log') {
    if (before && after) return 'Activity log entries cannot be changed';
    if (before && !after && logCount < LOG_LIMIT) return 'Activity log entries cannot be removed';
    return who === 'none' ? 'Sign in first' : null;
  }

  if (who === 'open' || who === 'manager') return null;
  if (who === 'none') return 'Sign in first';

  // who === 'staff'
  if (MANAGER_ONLY.has(collection)) return 'Needs a manager';
  // The next order number moves with every new bill; the menu's display order is the manager's.
  if (collection === 'meta') return id === 'seq' && after ? null : 'Needs a manager';
  if (collection === 'items') {
    // Ordering counts stock down, so staff may change the stock figure and nothing else.
    return before && after && sameExcept(before, after, ['stock']) ? null : 'Needs a manager';
  }
  if (collection === 'customers') return after ? null : 'Needs a manager';
  if (collection === 'orders') {
    const closing = (status) => status === 'void' || status === 'walkout';
    if (!after) return before?.dishes?.length ? 'Needs a manager' : null; // only never-sent orders can be dropped
    if (closing(after.status) && after.status !== before?.status) return 'Needs a manager';
    if (before && closing(before.status)) return 'Needs a manager';
    if (before && removesSentDishes(before, after)) return 'Needs a manager';
    return null;
  }
  return 'Needs a manager';
}
