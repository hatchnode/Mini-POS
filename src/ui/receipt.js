import { CASH } from '../config.js';
import { balanceDue, calcTotals, isPaid, orderLabel } from '../domain/orders.js';
import { settledPayments } from '../domain/payments.js';
import { store } from '../state/store.js';
import { $ } from '../utils/dom.js';
import { dateTimeStr } from '../utils/date.js';
import { esc } from '../utils/text.js';
import { money } from './format.js';
import { closeButton, openModal } from './modal.js';

const row = (label, value) => `<tr><td>${label}</td><td class="r">${value}</td></tr>`;

/**
 * Receipt markup for an order. Paid orders print as a "RECEIPT"; anything not yet paid is a "BILL"
 * showing the amount due.
 * Layout lives in styles/print.css and is used both for the on-screen preview and for printing.
 */
export function receiptHtml(order, now = Date.now()) {
  const isOpen = order.status === 'open';
  const paid = isPaid(order);
  // Completed orders keep the totals frozen at completion (older data may include discount/tax/tip).
  const t = !isOpen && order.totals ? order.totals : calcTotals(order);
  const s = store.data.settings;

  const lines = order.lines
    .map(
      (l) =>
        `<tr><td>${l.qty}× ${esc(l.name)}${l.note ? `<div class="rn">${esc(l.note)}</div>` : ''}</td><td class="r">${money(l.price * l.qty)}</td></tr>`,
    )
    .join('');
  const legacyRows = [
    t.discount ? row('Discount', money(-t.discount)) : '',
    t.tax ? row('Tax', money(t.tax)) : '',
    t.tip ? row('Tip', money(t.tip)) : '',
  ].join('');

  // One "Paid" row per payment; the method is named only when it isn't cash.
  const payments = paid
    ? settledPayments(order)
        .map((p) => row(`Paid${p.method && p.method !== CASH ? ` · ${esc(p.method)}` : ''}`, money(p.amount)))
        .join('')
    : '';
  const people = [
    order.customerName ? `Customer: ${esc(order.customerName)}` : '',
    order.staff ? `Served by: ${esc(order.staff)}` : '',
  ]
    .filter(Boolean)
    .map((text) => `<div>${text}</div>`)
    .join('');

  return `<div class="rc">
    <div class="rc-c"><div class="rc-name">${esc(s.name)}</div></div>
    <hr><div class="rc-c">${paid ? 'RECEIPT' : 'BILL'}</div>
    <div>Order #${order.no} · ${esc(orderLabel(order))}</div>
    ${people}
    <table>
      ${order.createdAt ? row('Ordered', dateTimeStr(order.createdAt)) : ''}
      ${order.completedAt ? row('Completed', dateTimeStr(order.completedAt)) : row('Printed', dateTimeStr(now))}
    </table>
    ${order.status === 'void' ? '<div class="rc-c"><b>*** VOID ***</b></div>' : ''}
    <hr><table>${lines}</table>
    <hr><table>
      ${legacyRows ? row('Subtotal', money(t.subtotal)) + legacyRows : ''}
      ${row('<b>TOTAL</b>', `<b>${money(t.total)}</b>`)}
      ${payments}
      ${paid && order.paidAt ? row('Paid at', dateTimeStr(order.paidAt)) : ''}
      ${isOpen && !paid ? row('<b>AMOUNT DUE</b>', `<b>${money(balanceDue(order))}</b>`) : ''}
    </table>
    ${order.status === 'walkout' ? '<div class="rc-c"><b>*** NOT PAID · WALKED OUT ***</b></div>' : ''}
    <hr><div class="rc-c rc-contact">
      <div><b>${esc(s.name)}</b></div>
      ${s.address ? `<div>${esc(s.address)}</div>` : ''}
      ${s.phone ? `<div>Tel: ${esc(s.phone)}</div>` : ''}
    </div>
    ${s.footer ? `<div class="rc-c rc-footer">${esc(s.footer)}</div>` : ''}
  </div>`;
}

/** Show the receipt on screen, with a Print button. */
export function showReceipt(order) {
  const title = `${isPaid(order) ? 'Receipt' : 'Bill'} · ${esc(orderLabel(order))} #${order.no}`;
  openModal(`
    <div class="mh"><h3>${title}</h3>${closeButton}</div>
    <div class="mb"><div class="rc-preview">${receiptHtml(order)}</div></div>
    <div class="mf">
      <button data-act="closeModal">Close</button>
      <button class="btn-primary" data-act="printReceiptNow" data-id="${order.id}">Print</button>
    </div>`);
}

/**
 * Print the receipt. Must run directly inside the click handler: browsers may ignore
 * window.print() when it is called later (for example from a timer).
 */
export function printReceiptNow(order) {
  $('#print-area').innerHTML = receiptHtml(order);
  window.print();
}
