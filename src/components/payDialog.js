import { CASH } from '../config.js';
import { balanceDue, isPaid, orderLabel } from '../domain/orders.js';
import { tenderOptions } from '../domain/payments.js';
import { store } from '../state/store.js';
import { money } from '../ui/format.js';
import { closeButton, openModal } from '../ui/modal.js';
import { $ } from '../utils/dom.js';
import { centsToInput, parseCents } from '../utils/money.js';
import { esc } from '../utils/text.js';

export const paymentMethods = () => [CASH, ...(store.data.settings.otherPayments || [])];

/** Take payment: optionally type the cash received to see the change, then tap how it was paid. */
export function openPayDialog(order) {
  const due = balanceDue(order);
  const quick = [due, ...tenderOptions(due)]
    .map(
      (cents, i) =>
        `<button data-act="payQuick" data-v="${cents}">${i === 0 ? 'Exact' : money(cents)}</button>`,
    )
    .join('');
  const others = paymentMethods()
    .slice(1)
    .map(
      (m) =>
        `<button class="btn-primary" data-act="confirmPay" data-id="${order.id}" data-method="${esc(m)}">${esc(m)}</button>`,
    )
    .join('');
  openModal(`
    <div class="mh"><h3>Take payment · ${esc(orderLabel(order))} #${order.no}</h3>${closeButton}</div>
    <div class="mb">
      <div class="row total"><span>Amount due</span><span>${money(due)}</span></div>
      <label class="fld">Cash received from the customer
        <input id="pay-tendered" type="number" step="0.01" min="0" inputmode="decimal" data-input="payTendered" data-due="${due}" placeholder="${centsToInput(due)}">
      </label>
      <div class="quick">${quick}</div>
      <div class="row pay-change" id="pay-change"><span>Change to give</span><span>—</span></div>
    </div>
    <div class="mf pay-methods">
      <button class="btn-ok" data-act="confirmPay" data-id="${order.id}" data-method="${CASH}">${others ? 'Paid in cash' : `Paid ${money(due)}`}</button>
      ${others}
    </div>`);
}

/** Keep the "change to give" line in step with what is typed. */
export function updateChange() {
  const input = $('#pay-tendered');
  const line = $('#pay-change');
  if (!input || !line) return;
  const due = Number(input.dataset.due);
  const tendered = input.value === '' ? null : parseCents(input.value);
  const short = tendered != null && tendered < due;
  line.classList.toggle('bad', short);
  line.firstElementChild.textContent = short ? 'Still to pay' : 'Change to give';
  line.lastElementChild.textContent = tendered == null ? '—' : money(Math.abs(tendered - due));
}

/** After paying: show the change clearly and offer the receipt. */
export function openPaidDialog(order, { method, change }) {
  const where = order.table ? 'The table frees' : 'The order completes';
  const paid = order.payments[order.payments.length - 1].amount;
  const next = isPaid(order) && order.status === 'open' ? `${where} when every dish is served.` : '';
  openModal(`
    <div class="mh"><h3>Paid · ${esc(orderLabel(order))} #${order.no}</h3>${closeButton}</div>
    <div class="mb">
      <div class="row"><span>${method === CASH ? 'Paid' : `Paid by ${esc(method)}`}</span><b>${money(paid)}</b></div>
      ${change > 0 ? `<div class="row total pay-change"><span>Change to give</span><span>${money(change)}</span></div>` : ''}
      ${next ? `<p class="muted">${next}</p>` : ''}
    </div>
    <div class="mf">
      <button data-act="printReceipt" data-id="${order.id}">Receipt</button>
      <button class="btn-primary" data-act="closeModal">Done</button>
    </div>`);
}
