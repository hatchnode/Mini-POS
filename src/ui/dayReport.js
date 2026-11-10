import { drawerEntry, drawerSummary } from '../domain/drawer.js';
import { summarizeSales } from '../domain/sales.js';
import { staffName, store } from '../state/store.js';
import { $ } from '../utils/dom.js';
import { dateTimeStr, dayRange } from '../utils/date.js';
import { esc } from '../utils/text.js';
import { money } from './format.js';
import { closeButton, openModal } from './modal.js';

const row = (label, value) => `<tr><td>${label}</td><td class="r">${value}</td></tr>`;

/** End-of-day summary laid out like a receipt, for the thermal printer. */
export function dayReportHtml(date, now = Date.now()) {
  const { data } = store;
  const s = summarizeSales(data.orders, dayRange(date));
  const d = drawerSummary(drawerEntry(data, date), s.cashTotal);
  const voids = s.bills.filter((o) => o.status === 'void').length;
  const methods = s.byMethod.map((m) => row(`${esc(m.name)} (${m.count})`, money(m.amount))).join('');
  const staff = s.byStaff.map((m) => row(`${esc(m.name)} (${m.count})`, money(m.amount))).join('');
  const items = s.items.map((i) => row(`${i.qty}× ${esc(i.name)}`, money(i.revenue))).join('');
  const who = staffName();
  return `<div class="rc">
    <div class="rc-c"><div class="rc-name">${esc(data.settings.name)}</div></div>
    <hr><div class="rc-c">DAY REPORT</div>
    <div class="rc-c">${new Date(`${date}T00:00:00`).toLocaleDateString([], { dateStyle: 'full' })}</div>
    <hr><table>
      ${row('<b>PAID SALES</b>', `<b>${money(s.total)}</b>`)}
      ${row('Bills paid', s.paidCount)}
      ${row('Average bill', money(s.average))}
      ${row('Walk-outs', `${s.walkoutCount} · ${money(s.walkoutTotal)}`)}
      ${row('Voided bills', voids)}
    </table>
    ${methods ? `<hr><div>HOW IT WAS PAID</div><table>${methods}</table>` : ''}
    <hr><div>CASH DRAWER</div><table>
      ${row('Opening float', money(d.float))}
      ${row('Cash sales', money(d.cashSales))}
      ${row('Should be in drawer', money(d.expected))}
      ${row('Counted', d.counted == null ? '________' : money(d.counted))}
      ${d.difference == null ? '' : row(`<b>${d.difference < 0 ? 'SHORT' : d.difference > 0 ? 'OVER' : 'DIFFERENCE'}</b>`, `<b>${money(Math.abs(d.difference))}</b>`)}
    </table>
    ${staff ? `<hr><div>TAKEN BY</div><table>${staff}</table>` : ''}
    ${items ? `<hr><div>ITEMS SOLD</div><table>${items}</table>` : ''}
    <hr><div class="rc-c">Printed ${dateTimeStr(now)}${who ? ` by ${esc(who)}` : ''}</div>
  </div>`;
}

export function showDayReport(date) {
  openModal(`
    <div class="mh"><h3>Day report</h3>${closeButton}</div>
    <div class="mb"><div class="rc-preview">${dayReportHtml(date)}</div></div>
    <div class="mf">
      <button data-act="closeModal">Close</button>
      <button class="btn-primary" data-act="printDayReportNow">Print</button>
    </div>`);
}

/** Must run directly inside the click handler, like receipts. */
export function printDayReportNow(date) {
  $('#print-area').innerHTML = dayReportHtml(date);
  window.print();
}
