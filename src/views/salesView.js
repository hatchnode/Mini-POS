import { calcTotals, itemCount, openOrders, orderLabel } from '../domain/orders.js';
import { chartHours, summarizeSales } from '../domain/sales.js';
import { store } from '../state/store.js';
import { money } from '../ui/format.js';
import { dayRange, hourLabel, timeStr, todayStr } from '../utils/date.js';
import { esc } from '../utils/text.js';

const kpi = (label, value) =>
  `<div class="panel kpi"><div class="l">${label}</div><div class="v">${value}</div></div>`;

function hourlyChart(byHour) {
  const hours = chartHours(byHour);
  if (!hours.length) return '<div class="empty">No sales yet for this day.</div>';
  const max = Math.max(...Object.values(byHour));
  const bars = hours
    .map((h) => {
      const v = byHour[h] || 0;
      const fill =
        v && max ? `<div class="bar-f" style="height:${Math.max(2, (v / max) * 100)}%"></div>` : '';
      return `<div class="bar" title="${hourLabel(h)}: ${money(v)}"><div class="bar-w">${fill}</div><span>${hourLabel(h)}</span></div>`;
    })
    .join('');
  return `<div class="bars">${bars}</div>`;
}

function ordersTable(orders) {
  if (!orders.length) return '<div class="empty">No orders completed on this day.</div>';
  const rows = orders
    .map(
      (o) => `<tr class="${o.status === 'void' ? 'void' : ''}">
        <td>${o.no}</td><td>${timeStr(o.completedAt)}</td><td>${esc(orderLabel(o))}</td>
        <td class="n">${itemCount(o)}</td><td class="n">${money(o.totals.total)}</td>
        <td class="acts">
          <button class="small" data-act="printReceipt" data-id="${o.id}">Receipt</button>
          ${o.status === 'completed' ? `<button class="small btn-danger" data-act="voidSale" data-id="${o.id}">Void</button>` : '<span class="muted small">voided</span>'}
        </td></tr>`,
    )
    .join('');
  return `<table class="t"><thead><tr><th>#</th><th>Completed</th><th>Order</th><th class="n">Items</th><th class="n">Total</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function topItemsTable(items) {
  if (!items.length) return '<div class="empty">—</div>';
  const rows = items
    .map(
      (i) =>
        `<tr><td>${esc(i.name)}</td><td class="n">${i.qty}</td><td class="n">${money(i.revenue)}</td></tr>`,
    )
    .join('');
  return `<table class="t"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Sales</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderSalesView() {
  const { data, ui } = store;
  const s = summarizeSales(data.orders, dayRange(ui.salesDate));
  const isToday = ui.salesDate === todayStr();
  const open = openOrders(data);
  const openTotal = open.reduce((sum, o) => sum + calcTotals(o).total, 0);

  return `<div class="page">
    <div class="page-top"><h1>Sales</h1>
      <div class="inrow">
        <input type="date" value="${ui.salesDate}" max="${todayStr()}" data-change="salesDate" aria-label="Day">
        <button data-act="exportSalesCsv" ${s.orders.length ? '' : 'disabled'}>Export CSV</button>
      </div>
    </div>
    <div class="kpis">
      ${kpi('Total sales', money(s.total))}
      ${kpi('Orders', s.count)}
      ${kpi('Average order', money(s.average))}
      ${kpi('Items sold', s.itemsSold)}
      ${isToday ? kpi('Still open', `${open.length} · ${money(openTotal)}`) : ''}
    </div>
    <div class="split">
      <section class="panel"><div class="panel-h"><h2>Sales by hour</h2></div><div class="panel-b">${hourlyChart(s.byHour)}</div></section>
      <section class="panel"><div class="panel-h"><h2>Top items</h2></div>
        <div class="tablewrap">${topItemsTable(s.topItems)}</div></section>
    </div>
    <section class="panel"><div class="panel-h"><h2>Completed orders</h2><span class="muted small">${s.orders.length}</span></div>
      <div class="tablewrap">${ordersTable(s.orders)}</div></section>
  </div>`;
}
