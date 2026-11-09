import { calcTotals, orderLabel } from '../domain/orders.js';
import { store } from '../state/store.js';
import { $ } from '../utils/dom.js';
import { dateTimeStr } from '../utils/date.js';
import { capitalize, esc } from '../utils/text.js';
import { money } from './format.js';

const row = (label, value) => `<tr><td>${label}</td><td class="r">${value}</td></tr>`;

/** Print a guest bill (`bill: true`, before payment) or a paid receipt. Layout lives in styles/print.css. */
export function printReceipt(order, { bill = false } = {}) {
  const t = !bill && order.totals ? order.totals : calcTotals(order);
  const s = store.data.settings;

  let paymentRows = '';
  if (!bill && order.payment) {
    paymentRows = row(capitalize(order.payment.method), money(order.payment.tendered));
    if (order.payment.method === 'cash') paymentRows += row('Change', money(order.payment.change));
  }
  const lines = order.lines
    .map(
      (l) =>
        `<tr><td>${l.qty}× ${esc(l.name)}${l.note ? `<div class="rn">${esc(l.note)}</div>` : ''}</td><td class="r">${money(l.price * l.qty)}</td></tr>`,
    )
    .join('');

  $('#print-area').innerHTML = `<div class="rc">
    <div class="rc-c"><div class="rc-name">${esc(s.name)}</div>${s.address ? `<div>${esc(s.address)}</div>` : ''}</div>
    <hr><div class="rc-c">${bill ? 'GUEST BILL' : 'RECEIPT'}</div>
    <div>Order #${order.no} · ${esc(orderLabel(order))}</div>
    <div>${dateTimeStr(bill ? Date.now() : order.paidAt || Date.now())}</div>
    ${order.status === 'void' ? '<div class="rc-c"><b>*** VOID ***</b></div>' : ''}
    <hr><table>${lines}</table>
    <hr><table>
      ${row('Subtotal', money(t.subtotal))}
      ${t.discount ? row('Discount', money(-t.discount)) : ''}
      ${t.tax ? row('Tax', money(t.tax)) /* only on orders paid before tax was removed */ : ''}
      ${t.tip ? row('Tip', money(t.tip)) : ''}
      ${row('<b>TOTAL</b>', `<b>${money(t.total)}</b>`)}
      ${paymentRows}
    </table>
    ${bill && !t.tip ? '<hr><div>Tip: ________________</div><br><div>Total: ______________</div>' : ''}
    ${s.footer ? `<hr><div class="rc-c">${esc(s.footer)}</div>` : ''}
  </div>`;
  setTimeout(() => window.print(), 50);
}
