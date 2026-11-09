import { dishDuration, isServed } from '../domain/kitchen.js';
import { balanceDue, billTotal, itemCount, orderDuration, orderLabel } from '../domain/orders.js';
import { PAYMENT_STATUS_LABEL, awaitingPayment, paymentStatus } from '../domain/payments.js';
import { chartHours, settledAt, summarizeSales } from '../domain/sales.js';
import { store } from '../state/store.js';
import { money } from '../ui/format.js';
import { dayRange, durationStr, hourLabel, timeAgo, timeOnDay, timeStr, todayStr } from '../utils/date.js';
import { esc } from '../utils/text.js';

const kpi = (label, value, cls = '') =>
  `<div class="panel kpi ${cls}"><div class="l">${label}</div><div class="v">${value}</div></div>`;

const pill = (status) => `<span class="pill ${status}">${PAYMENT_STATUS_LABEL[status] || status}</span>`;

function hourlyChart(byHour) {
  const hours = chartHours(byHour);
  if (!hours.length) return '<div class="empty">No paid bills yet for this day.</div>';
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

/** Open bills still owing money, served ones first: the ones to chase before customers leave. */
function awaitingSection(orders) {
  if (!orders.length) return '';
  const rows = orders
    .map(
      (o) => `<tr>
        <td>${esc(orderLabel(o))} <span class="muted">#${o.no}</span></td>
        <td>${isServed(o) ? pill('served-unpaid') : pill('unpaid')}</td>
        <td>${timeStr(o.createdAt)} <span class="muted small">· ${timeAgo(o.createdAt)}</span></td>
        <td class="n"><b>${money(balanceDue(o))}</b></td>
        <td class="acts">
          <button class="small btn-ok" data-act="markPaid" data-id="${o.id}">Mark paid</button>
          ${o.dishes?.length ? `<button class="small btn-danger" data-act="markWalkout" data-id="${o.id}">Walked out</button>` : ''}
        </td>
      </tr>`,
    )
    .join('');
  const total = orders.reduce((s, o) => s + balanceDue(o), 0);
  return `<section class="panel attention">
    <div class="panel-h"><h2>Awaiting payment</h2><span class="small bad"><b>${orders.length} · ${money(total)}</b></span></div>
    <div class="tablewrap"><table class="t">
      <thead><tr><th>Order</th><th>Status</th><th>Opened</th><th class="n">Due</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
  </section>`;
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
        <td>${pill(d.bill)}</td>
      </tr>`,
    )
    .join('');
  return `<table class="t"><thead><tr><th>Order</th><th>Dish</th><th>Ordered</th><th>Completed</th><th class="n">Time taken</th><th class="n">Amount</th><th>Bill</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Bills settled on this day (paid, walked out or void), for reprinting or voiding. */
function billsTable(bills) {
  if (!bills.length) return '<div class="empty">No bills settled on this day.</div>';
  const rows = bills
    .map((o) => {
      const status = paymentStatus(o);
      const canVoid = status === 'paid' && o.status === 'completed';
      return `<tr class="${status === 'void' ? 'void' : ''}">
        <td>${o.no}</td><td>${esc(orderLabel(o))}</td>
        <td>${o.createdAt ? timeOnDay(o.createdAt, settledAt(o)) : '—'}</td>
        <td>${timeStr(settledAt(o))}</td>
        <td class="n">${durationStr(orderDuration(o))}</td>
        <td class="n">${itemCount(o)}</td><td class="n">${money(billTotal(o))}</td>
        <td>${pill(status)}</td>
        <td class="acts">
          <button class="small" data-act="printReceipt" data-id="${o.id}">Receipt</button>
          ${canVoid ? `<button class="small btn-danger" data-act="voidSale" data-id="${o.id}">Void</button>` : ''}
        </td></tr>`;
    })
    .join('');
  return `<table class="t"><thead><tr><th>#</th><th>Order</th><th>Opened</th><th>Settled</th><th class="n">Took</th><th class="n">Items</th><th class="n">Total</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
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
  const owing = isToday ? awaitingPayment(data) : [];
  const owingTotal = owing.reduce((sum, o) => sum + balanceDue(o), 0);

  return `<div class="page">
    <div class="page-top"><h1>Sales</h1>
      <div class="inrow">
        <input type="date" value="${ui.salesDate}" max="${todayStr()}" data-change="salesDate" aria-label="Day">
        <button data-act="exportSalesCsv" ${s.dishes.length ? '' : 'disabled'}>Export CSV</button>
      </div>
    </div>
    <div class="kpis">
      ${kpi('Paid sales', money(s.total))}
      ${kpi('Bills paid', s.paidCount)}
      ${kpi('Average bill', money(s.average))}
      ${isToday ? kpi('Awaiting payment', `${owing.length} · ${money(owingTotal)}`, owing.length ? 'warn' : '') : ''}
      ${kpi('Walk-outs', `${s.walkoutCount} · ${money(s.walkoutTotal)}`, s.walkoutCount ? 'warn' : '')}
      ${kpi('Dishes completed', `${s.dishCount} <span class="muted small">(${s.itemsSold} items)</span>`)}
      ${kpi('Avg. dish time', durationStr(s.averageDishTime))}
    </div>
    ${awaitingSection(owing)}
    <div class="split">
      <section class="panel"><div class="panel-h"><h2>Paid sales by hour</h2></div><div class="panel-b">${hourlyChart(s.byHour)}</div></section>
      <section class="panel"><div class="panel-h"><h2>Top items (paid)</h2></div>
        <div class="tablewrap">${topItemsTable(s.topItems)}</div></section>
    </div>
    <section class="panel"><div class="panel-h"><h2>Bills</h2><span class="muted small">${s.bills.length}</span></div>
      <div class="tablewrap">${billsTable(s.bills)}</div></section>
    <section class="panel"><div class="panel-h"><h2>Dish log</h2><span class="muted small">${s.dishCount} completed</span></div>
      <div class="tablewrap">${dishLog(s.dishes)}</div></section>
  </div>`;
}
