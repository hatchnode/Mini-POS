import { openPaidDialog, openPayDialog, updateChange } from '../components/payDialog.js';
import { balanceDue, orderLabel } from '../domain/orders.js';
import { ALARM_SNOOZE_MINUTES, CASH } from '../config.js';
import { snoozeAlarm } from '../domain/alarms.js';
import { markPaid, markWalkout } from '../domain/payments.js';
import { save, staffName, store } from '../state/store.js';
import { audit, withManager } from '../ui/access.js';
import { money } from '../ui/format.js';
import { confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';
import { centsToInput, parseCents } from '../utils/money.js';

/** Buttons carry the order id in data-id (from the ticket or from Sales). */
const findOrder = (el) => store.data.orders.find((o) => o.id === el.dataset.id);

function releaseIfClosed(order) {
  if (order.status !== 'open' && store.ui.currentOrderId === order.id) store.ui.currentOrderId = null;
}

export const click = {
  /** "Mark paid" opens the payment dialog; the method buttons there finish it. */
  markPaid(el) {
    const order = findOrder(el);
    if (order) openPayDialog(order);
  },
  payQuick(el) {
    $('#pay-tendered').value = centsToInput(Number(el.dataset.v));
    updateChange();
  },
  confirmPay(el) {
    const order = findOrder(el);
    if (!order) return;
    const method = el.dataset.method;
    const typed = $('#pay-tendered')?.value ?? '';
    const tendered = method === CASH && typed !== '' ? parseCents(typed) : null;
    const result = markPaid(order, Date.now(), { method, tendered, staff: staffName() });
    if (!result.ok) return toast(result.error);
    releaseIfClosed(order);
    save();
    render();
    openPaidDialog(order, { method, change: result.change });
  },
  markWalkout(el) {
    const order = findOrder(el);
    if (!order) return;
    confirmDialog({
      message: `Record ${orderLabel(order)} #${order.no} as walked out without paying (${money(balanceDue(order))})? The table will be freed and the loss shown in Sales.`,
      confirmLabel: 'Record walk-out',
      danger: true,
      onConfirm: () =>
        withManager('record a walk-out', (approver) => {
          const lost = balanceDue(order);
          const result = markWalkout(order);
          if (!result.ok) return toast(result.error);
          audit('walkout', `Walk-out: ${orderLabel(order)} #${order.no}, ${money(lost)} unpaid`, approver);
          releaseIfClosed(order);
          save();
          render();
          toast(`Walk-out recorded for ${orderLabel(order)} #${order.no}`);
        }),
    });
  },
  /** Alarm banner: jump to the unpaid order on the Orders screen. */
  openAlarmOrder(el) {
    const order = findOrder(el);
    if (!order) return;
    Object.assign(store.ui, {
      view: 'orders',
      currentOrderId: order.id,
      pendingTable: null,
      editTables: false,
    });
    render();
  },
  /** The customer is clearly still there (e.g. ordering dessert): silence this table for a while. */
  snoozeAlarm(el) {
    const order = findOrder(el);
    if (!order) return;
    snoozeAlarm(order, Date.now(), ALARM_SNOOZE_MINUTES);
    save();
    render();
    toast(`${orderLabel(order)} alarm snoozed for ${ALARM_SNOOZE_MINUTES} min`);
  },
};

export const input = {
  payTendered: () => updateChange(),
};
