import { calcTotals, itemCount, openOrders, orderDuration, orderLabel } from '../domain/orders.js';
import { dishDuration } from '../domain/kitchen.js';
import { chartHours, summarizeSales } from '../domain/sales.js';
import { store } from '../state/store.js';
import { money } from '../ui/format.js';
import { dayRange, durationStr, hourLabel, timeOnDay, timeStr, todayStr } from '../utils/date.js';
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

/** The order log: one row per dish, with its own order and completion time. */
function dishLog(dishes) {
  if (!dishes.length) return '<div class="empty">No dishes completed on this day.</div>';
  const rows = dishes
    .map(
      (d) => `<tr>
        <td>${esc(d.orderLabel)} <span class="muted">#${d.orderNo}</span></td>
        <td><b>${d.qty}×</b> ${esc(d.name)}${d.note ? ` <span class="note">${esc(d.note)}</span>` : ''}</td>
        <td>${d.orderedAt ? timeOnDay(d.orderedAt, d.completedAt) : '—'}</td>
        <td>${timeStr(d.completedAt)}</td>
        <td class="n">${durationStr(dishDuration(d))}</td>
        <td class="n">${money(d.price * d.qty)}</td>
      </tr>`,
    )
    .join('');
  return `<table class="t"><thead><tr><th>Order</th><th>Dish</th><th>Ordered</th><th>Completed</th><th class="n">Time taken</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Finished bills, for reprinting or voiding. */
function billsTable(orders) {
  if (!orders.length) return '<div class="empty">No tables finished on this day.</div>';
  const rows = orders
    .map(
      (o) => `<tr class="${o.status === 'void' ? 'void' : ''}">
        <td>${o.no}</td><td>${esc(orderLabel(o))}</td>
        <td>${o.createdAt ? timeOnDay(o.createdAt, o.completedAt) : '—'}</td><td>${timeStr(o.completedAt)}</td>
        <td class="n">${durationStr(orderDuration(o))}</td>
        <td class="n">${itemCount(o)}</td><td class="n">${money(o.totals.total)}</td>
        <td class="acts">
          <button class="small" data-act="printReceipt" data-id="${o.id}">Receipt</button>
          ${o.status === 'completed' ? `<button class="small btn-danger" data-act="voidSale" data-id="${o.id}">Void</button>` : '<span class="muted small">voided</span>'}
        </td></tr>`,
    )
    .join('');
  return `<table class="t"><thead><tr><th>#</th><th>Order</th><th>Opened</th><th>Finished</th><th class="n">Took</th><th class="n">Items</th><th class="n">Total</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
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
        <button data-act="exportSalesCsv" ${s.dishes.length ? '' : 'disabled'}>Export CSV</button>
      </div>
    </div>
    <div class="kpis">
      ${kpi('Total sales', money(s.total))}
      ${kpi('Dishes completed', `${s.dishCount} <span class="muted small">(${s.itemsSold} items)</span>`)}
      ${kpi('Avg. dish time', durationStr(s.averageDishTime))}
      ${kpi('Tables served', s.tablesServed)}
      ${isToday ? kpi('Still open', `${open.length} · ${money(openTotal)}`) : ''}
    </div>
    <div class="split">
      <section class="panel"><div class="panel-h"><h2>Sales by hour</h2></div><div class="panel-b">${hourlyChart(s.byHour)}</div></section>
      <section class="panel"><div class="panel-h"><h2>Top items</h2></div>
        <div class="tablewrap">${topItemsTable(s.topItems)}</div></section>
    </div>
    <section class="panel"><div class="panel-h"><h2>Dish log</h2><span class="muted small">${s.dishCount} completed</span></div>
      <div class="tablewrap">${dishLog(s.dishes)}</div></section>
    <section class="panel"><div class="panel-h"><h2>Tables &amp; bills</h2><span class="muted small">${s.orders.length}</span></div>
      <div class="tablewrap">${billsTable(s.orders)}</div></section>
  </div>`;
}
