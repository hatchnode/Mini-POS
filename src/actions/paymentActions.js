import { balanceDue, orderLabel } from '../domain/orders.js';
import { markPaid, markWalkout } from '../domain/payments.js';
import { save, store } from '../state/store.js';
import { money } from '../ui/format.js';
import { confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

/** Buttons carry the order id in data-id (from the ticket or from Sales). */
const findOrder = (el) => store.data.orders.find((o) => o.id === el.dataset.id);

function releaseIfClosed(order) {
  if (order.status !== 'open' && store.ui.currentOrderId === order.id) store.ui.currentOrderId = null;
}

export const click = {
  markPaid(el) {
    const order = findOrder(el);
    if (!order) return;
    const due = balanceDue(order);
    confirmDialog({
      message: `Mark ${orderLabel(order)} #${order.no} as paid (${money(due)})?`,
      confirmLabel: `Paid ${money(due)}`,
      onConfirm: () => {
        const result = markPaid(order);
        if (!result.ok) return toast(result.error);
        releaseIfClosed(order);
        save();
        render();
        toast(
          result.completed
            ? `${orderLabel(order)} #${order.no} paid and completed.${order.table ? ' Table is free.' : ''}`
            : `${orderLabel(order)} #${order.no} paid. ${order.table ? 'The table frees' : 'It completes'} when every dish is served.`,
        );
      },
    });
  },
  markWalkout(el) {
    const order = findOrder(el);
    if (!order) return;
    confirmDialog({
      message: `Record ${orderLabel(order)} #${order.no} as walked out without paying (${money(balanceDue(order))})? The table will be freed and the loss shown in Sales.`,
      confirmLabel: 'Record walk-out',
      danger: true,
      onConfirm: () => {
        const result = markWalkout(order);
        if (!result.ok) return toast(result.error);
        releaseIfClosed(order);
        save();
        render();
        toast(`Walk-out recorded for ${orderLabel(order)} #${order.no}`);
      },
    });
  },
};
