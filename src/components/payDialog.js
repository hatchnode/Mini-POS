import { CASH } from '../config.js';
import { balanceDue, orderLabel } from '../domain/orders.js';
import { store } from '../state/store.js';
import { money } from '../ui/format.js';
import { closeButton, openModal } from '../ui/modal.js';
import { esc } from '../utils/text.js';

export const paymentMethods = () => [CASH, ...(store.data.settings.otherPayments || [])];

/**
 * Confirm that a bill has been paid. Cash is the only way to pay unless others are listed in
 * Settings, in which case each gets its own button.
 */
export function openPayDialog(order) {
  const due = balanceDue(order);
  const others = paymentMethods()
    .slice(1)
    .map(
      (m) =>
        `<button class="btn-primary" data-act="confirmPay" data-id="${order.id}" data-method="${esc(m)}">${esc(m)}</button>`,
    )
    .join('');
  openModal(`
    <div class="mh"><h3>Mark paid · ${esc(orderLabel(order))} #${order.no}</h3>${closeButton}</div>
    <div class="mb">
      <div class="row total"><span>Amount due</span><span>${money(due)}</span></div>
    </div>
    <div class="mf pay-methods">
      <button data-act="closeModal">Cancel</button>
      <button class="btn-ok" data-act="confirmPay" data-id="${order.id}" data-method="${CASH}">${others ? 'Paid in cash' : `Paid ${money(due)}`}</button>
      ${others}
    </div>`);
}
