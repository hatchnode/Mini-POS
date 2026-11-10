/**
 * Who may do what. With no staff set up everything is allowed, exactly as before. With staff set
 * up, sensitive actions need a manager: either a manager is signed in, or one types their PIN to
 * approve what a staff member is doing.
 */
import { openPinDialog } from '../components/pinDialog.js';
import { logEvent } from '../domain/log.js';
import { isManager, managerByPin, staffEnabled } from '../domain/staff.js';
import { currentStaff, staffName, store } from '../state/store.js';

/** Staff are set up and nobody is signed in: only the lock screen is shown. */
export const isLocked = () => staffEnabled(store.data) && !currentStaff();

export const canManage = () => !staffEnabled(store.data) || isManager(currentStaff());

/**
 * Run `fn` if a manager is signed in; otherwise ask for a manager's PIN first. `fn` receives the
 * approving manager, or null when no approval was needed. `what` finishes "…their PIN to ___".
 */
export function withManager(what, fn) {
  if (canManage()) return fn(null);
  openPinDialog({
    title: 'Manager PIN needed',
    hint: `Ask a manager to enter their PIN to ${what}.`,
    check: (pin) => managerByPin(store.data, pin),
    onOk: fn,
  });
}

/** Add a line to the activity log, with who did it and who approved it. */
export function audit(type, text, approver = null) {
  const who = staffName();
  logEvent(store.data, type, text, approver && who ? `${who} (approved by ${approver.name})` : who);
}
