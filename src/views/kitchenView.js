import { READY_LIST_HOURS } from '../config.js';
import {
  completesOrder,
  dishDuration,
  dishUrgency,
  kitchenQueue,
  pendingDishCount,
  readyDishes,
} from '../domain/kitchen.js';
import { orderLabel } from '../domain/orders.js';
import { store } from '../state/store.js';
import { durationStr, timeAgo, timeStr } from '../utils/date.js';
import { esc } from '../utils/text.js';

const noteHtml = (d) => (d.note ? `<div class="note">${esc(d.note)}</div>` : '');

function dishRow(order, d, now) {
  const label = completesOrder(order, d) ? 'Ready · complete order' : 'Ready';
  return `<li class="dish ${dishUrgency(d, now)}">
    <div class="dish-main">
      <div><b>${d.qty}×</b> ${esc(d.name)}</div>
      ${noteHtml(d)}
      <div class="muted small">ordered ${timeStr(d.orderedAt)} · ${timeAgo(d.orderedAt, now)}</div>
    </div>
    <button class="btn-ok" data-act="markDishReady" data-order="${order.id}" data-id="${d.id}">${label}</button>
  </li>`;
}

function orderCard({ order, dishes }, now) {
  return `<article class="kcard ${dishUrgency(dishes[0], now)}">
    <header><b>${esc(orderLabel(order))}</b><span class="muted">#${order.no} · ${dishes.length} cooking</span></header>
    <ul>${dishes.map((d) => dishRow(order, d, now)).join('')}</ul>
  </article>`;
}

function readyTable(rows) {
  if (!rows.length)
    return `<div class="panel empty">Nothing marked ready in the last ${READY_LIST_HOURS} hours.</div>`;
  const body = rows
    .map(
      ({ order, dish: d }) => `<tr>
        <td>${timeStr(d.completedAt)}</td>
        <td>${esc(orderLabel(order))} <span class="muted">#${order.no}</span></td>
        <td><b>${d.qty}×</b> ${esc(d.name)}${d.note ? ` <span class="note">${esc(d.note)}</span>` : ''}</td>
        <td>${timeStr(d.orderedAt)}</td>
        <td class="n">${durationStr(dishDuration(d))}</td>
        <td class="acts"><button class="small" data-act="recallDish" data-order="${order.id}" data-id="${d.id}">Recall</button></td>
      </tr>`,
    )
    .join('');
  return `<section class="panel"><div class="tablewrap"><table class="t">
    <thead><tr><th>Ready</th><th>Order</th><th>Dish</th><th>Ordered</th><th class="n">Took</th><th></th></tr></thead>
    <tbody>${body}</tbody></table></div></section>`;
}

export function renderKitchenView() {
  const { data, ui } = store;
  const now = Date.now();
  const queue = kitchenQueue(data);
  const cooking = pendingDishCount(data);
  const ready = readyDishes(data, now - READY_LIST_HOURS * 3600000);

  const toggle = ui.showReadyDishes ? `Show cooking (${cooking})` : `Show ready (${ready.length})`;
  const head = `<div class="khead">
      <h1>Kitchen · ${ui.showReadyDishes ? 'ready' : `${cooking} cooking`}</h1>
      <button data-act="toggleReadyDishes">${toggle}</button>
    </div>`;

  if (ui.showReadyDishes) return head + readyTable(ready);
  if (!queue.length) {
    return `${head}<div class="panel empty">Nothing cooking. Dishes appear here when you tap “Send to kitchen”.
      Mark each dish ready when it's done; the table frees once all its dishes are ready.</div>`;
  }
  return `${head}<div class="kgrid">${queue.map((g) => orderCard(g, now)).join('')}</div>`;
}
