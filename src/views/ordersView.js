import { isInKitchen } from '../domain/kitchen.js';
import { calcTotals, itemCount, openOrders, orderLabel, unsentCount } from '../domain/orders.js';
import { currentOrder, store } from '../state/store.js';
import { categoryColor, categoryIndex, money } from '../ui/format.js';
import { timeStr } from '../utils/date.js';
import { esc, plural } from '../utils/text.js';

/** Menu tiles for the current category and search. Also re-rendered alone while typing in search. */
export function renderItemsGrid() {
  const { data, ui } = store;
  const q = ui.search.trim().toLowerCase();
  const items = data.items
    .filter((i) => i.active && (ui.category === 'all' || i.catId === ui.category))
    .filter((i) => !q || i.name.toLowerCase().includes(q))
    .sort((a, b) => categoryIndex(a.catId) - categoryIndex(b.catId));
  if (!items.length) return '<div class="empty span-all">No items here. Add some in the Menu tab.</div>';
  return items
    .map(
      (i) =>
        `<button class="item" style="--c:${categoryColor(i.catId)}" data-act="addItem" data-id="${i.id}"><b>${esc(i.name)}</b><span>${money(i.price)}</span></button>`,
    )
    .join('');
}

function tablesPanel(order, open) {
  const { data, ui } = store;
  const count = data.settings.tables;
  let tables = '';
  for (let n = 1; n <= count; n++) {
    const o = open.find((x) => x.table === n);
    const selected = order?.table === n || ui.pendingTable === n;
    tables += `<button class="tbl ${o ? 'busy' : ''} ${selected ? 'sel' : ''}" data-act="selectTable" data-n="${n}" aria-label="Table ${n}">
      ${n}<small>${o ? money(calcTotals(o).total) : 'free'}</small></button>`;
  }
  // Takeaways, tables beyond the current table count, and a second open order on an occupied
  // table (e.g. a recalled order) are listed separately so none is hidden.
  const firstOnTable = new Map();
  open.forEach((o) => {
    if (o.table != null && !firstOnTable.has(o.table)) firstOnTable.set(o.table, o);
  });
  const others = open.filter((o) => o.table == null || o.table > count || firstOnTable.get(o.table) !== o);
  const otherList = others
    .map(
      (o) =>
        `<button class="orow ${order?.id === o.id ? 'sel' : ''}" data-act="openOrder" data-id="${o.id}">
          <span>${esc(orderLabel(o))} <span class="muted">#${o.no}</span></span><b>${money(calcTotals(o).total)}</b></button>`,
    )
    .join('');

  return `<section class="panel tables-panel">
    <div class="panel-h"><h2>Tables</h2><span class="muted small">${open.length} open</span></div>
    <div class="panel-b scroll" data-keep="tables">
      ${count ? `<div class="tables">${tables}</div>` : ''}
      <button class="take-btn ${ui.pendingTable === 'take' ? 'sel' : ''}" data-act="newTakeaway">+ New takeaway</button>
      ${others.length ? `<div class="sub">Takeaway &amp; other</div><div class="olist">${otherList}</div>` : ''}
    </div>
  </section>`;
}

function menuPanel() {
  const { data, ui } = store;
  const chips = [{ id: 'all', name: 'All' }, ...data.categories]
    .map(
      (c) =>
        `<button class="chip ${ui.category === c.id ? 'on' : ''}" data-act="selectCategory" data-id="${c.id}">${esc(c.name)}</button>`,
    )
    .join('');
  return `<section class="panel menu-panel">
    <div class="panel-h menu-h">
      <div class="cats">${chips}</div>
      <input type="search" placeholder="Search menu…" value="${esc(ui.search)}" data-input="searchMenu" aria-label="Search menu">
    </div>
    <div class="panel-b scroll" data-keep="menu"><div class="items" id="item-grid">${renderItemsGrid()}</div></div>
  </section>`;
}

function lineRow(l) {
  return `<div class="line">
    <div>
      <div class="nm">${esc(l.name)}${l.qty > l.sent ? '<span class="new-dot" title="Not yet sent to kitchen"></span>' : ''}</div>
      ${l.note ? `<div class="note">↳ ${esc(l.note)}</div>` : ''}
      <div class="meta">${money(l.price)} each · <button class="linkbtn" data-act="editNote" data-id="${l.id}">${l.note ? 'Edit note' : 'Add note'}</button></div>
    </div>
    <div class="ln-side">
      <div class="qty">
        <button data-act="decreaseLine" data-id="${l.id}" aria-label="Remove one">−</button>
        <b>${l.qty}</b>
        <button data-act="increaseLine" data-id="${l.id}" aria-label="Add one">+</button>
      </div>
      <div class="lt">${money(l.price * l.qty)}</div>
    </div>
  </div>`;
}

function ticketPanel(order) {
  if (!order) {
    const p = store.ui.pendingTable;
    const title = p == null ? 'Ticket' : p === 'take' ? 'New takeaway' : `Table ${p}`;
    const hint = p == null ? 'Select a table or start a takeaway.' : 'Tap menu items to start this order.';
    return `<div class="panel-h"><div class="tk-title">${title}</div></div><div class="scroll empty">${hint}</div>`;
  }
  const t = calcTotals(order);
  const unsent = unsentCount(order);
  const hasLines = order.lines.length > 0;
  const inKitchen = isInKitchen(store.data, order.id);
  let status = '';
  if (inKitchen && !unsent) status = 'In the kitchen. This order completes when the kitchen marks it ready.';
  else if (inKitchen) status = 'Part of this order is in the kitchen. Send the new items too.';

  return `<div class="panel-h">
      <div><div class="tk-title">${esc(orderLabel(order))}</div><div class="muted small">Order #${order.no} · opened ${timeStr(order.createdAt)}</div></div>
      <div class="inrow">
        ${store.data.settings.tables ? '<button class="small" data-act="moveOrder">Move</button>' : ''}
        <button class="small btn-danger" data-act="voidOrder">Void</button>
      </div>
    </div>
    <div class="scroll panel-b" data-keep="ticket">${hasLines ? order.lines.map(lineRow).join('') : '<div class="empty">No items yet.</div>'}</div>
    <div class="sum">
      <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>
    </div>
    <div class="actions">
      ${status ? `<div class="status-note">${status}</div>` : ''}
      <button class="btn-primary wide" data-act="sendToKitchen" ${unsent ? '' : 'disabled'}>Send to kitchen${unsent ? ` (${unsent})` : ''}</button>
      <button data-act="printBill" ${hasLines ? '' : 'disabled'}>Print bill</button>
    </div>`;
}

export function renderOrdersView() {
  const order = currentOrder();
  const open = openOrders(store.data);
  const mobileBar = order
    ? `<button class="mobile-bar" data-act="scrollToTicket">View ticket · ${plural(itemCount(order), 'item')} · ${money(calcTotals(order).total)}</button>`
    : '';
  return `<div class="pos">
    ${tablesPanel(order, open)}
    ${menuPanel()}
    <section class="panel ticket-panel">${ticketPanel(order)}</section>
  </div>${mobileBar}`;
}
