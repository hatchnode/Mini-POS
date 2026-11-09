import { calcTotals, orderLabel } from '../domain/orders.js';
import { store } from '../state/store.js';
import { $ } from '../utils/dom.js';
import { dateTimeStr } from '../utils/date.js';
import { esc } from '../utils/text.js';
import { money } from './format.js';

const row = (label, value) => `<tr><td>${label}</td><td class="r">${value}</td></tr>`;

/**
 * Print an order. Open orders print as a "BILL", completed ones as a "RECEIPT".
 * Layout lives in styles/print.css.
 */
export function printReceipt(order) {
  const isOpen = order.status === 'open';
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

  $('#print-area').innerHTML = `<div class="rc">
    <div class="rc-c"><div class="rc-name">${esc(s.name)}</div>${s.address ? `<div>${esc(s.address)}</div>` : ''}</div>
    <hr><div class="rc-c">${isOpen ? 'BILL' : 'RECEIPT'}</div>
    <div>Order #${order.no} · ${esc(orderLabel(order))}</div>
    <table>
      ${order.createdAt ? row('Ordered', dateTimeStr(order.createdAt)) : ''}
      ${order.completedAt ? row('Completed', dateTimeStr(order.completedAt)) : row('Printed', dateTimeStr(Date.now()))}
    </table>
    ${order.status === 'void' ? '<div class="rc-c"><b>*** VOID ***</b></div>' : ''}
    <hr><table>${lines}</table>
    <hr><table>
      ${legacyRows ? row('Subtotal', money(t.subtotal)) + legacyRows : ''}
      ${row('<b>TOTAL</b>', `<b>${money(t.total)}</b>`)}
    </table>
    ${s.footer ? `<hr><div class="rc-c">${esc(s.footer)}</div>` : ''}
  </div>`;
  setTimeout(() => window.print(), 50);
}
