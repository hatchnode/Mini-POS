import { customerStats, findCustomer, rewardStatus } from '../domain/customers.js';
import { popularItemIds } from '../domain/insights.js';
import { isInKitchen, isServed, lineKitchenStatus } from '../domain/kitchen.js';
import {
  balanceDue,
  calcTotals,
  isPaid,
  itemCount,
  openOrders,
  orderLabel,
  unsentCount,
} from '../domain/orders.js';
import { stockLevel } from '../domain/stock.js';
import { findTable, tableLabel } from '../domain/tables.js';
import { currentOrder, store } from '../state/store.js';
import { alarmingOrderIds } from '../ui/alarm.js';
import { categoryColor, categoryIndex, money } from '../ui/format.js';
import { timeStr } from '../utils/date.js';
import { esc, plural } from '../utils/text.js';

/** A menu tile. Items with tracked stock show what is left; sold-out ones can't be tapped. */
function itemTile(i) {
  const level = stockLevel(i, Number(store.data.settings.lowStock) || 0);
  const left = level
    ? `<em class="stock ${level}">${level === 'out' ? 'Sold out' : `${i.stock} left`}</em>`
    : '';
  return `<button class="item ${level === 'out' ? 'out' : ''}" style="--c:${categoryColor(i.catId)}" data-act="addItem" data-id="${i.id}" ${level === 'out' ? 'disabled' : ''}>
    <b>${esc(i.name)}</b><span class="item-foot"><span>${money(i.price)}</span>${left}</span></button>`;
}

/** Menu tiles for the current category and search. Also re-rendered alone while typing in search. */
export function renderItemsGrid() {
  const { data, ui } = store;
  const q = ui.search.trim().toLowerCase();
  const matches = (i) => i.active && (!q || i.name.toLowerCase().includes(q));
  let items;
  if (ui.category === 'popular') {
    // Best sellers first, so the things ordered most are one tap away.
    items = popularItemIds(data)
      .map((id) => data.items.find((i) => i.id === id))
      .filter((i) => i && matches(i));
  } else {
    items = data.items
      .filter((i) => matches(i) && (ui.category === 'all' || i.catId === ui.category))
      .sort((a, b) => categoryIndex(a.catId) - categoryIndex(b.catId));
  }
  if (!items.length) return '<div class="empty span-all">No items here. Add some in the Menu tab.</div>';
  return items.map(itemTile).join('');
}

function tableTile(t, firstOpen, order, editing, alarming) {
  const { ui } = store;
  const o = firstOpen.get(t.id);
  const selected = !editing && (order?.table === t.id || ui.pendingTable === t.id);
  const unpaid = o && isServed(o) && !isPaid(o);
  let sub = 'free';
  if (editing) sub = 'rename';
  else if (unpaid) sub = `unpaid ${money(balanceDue(o))}`;
  else if (o && isPaid(o)) sub = 'paid';
  else if (o) sub = money(calcTotals(o).total);
  const cls = [
    'tbl',
    o ? 'busy' : '',
    unpaid ? 'unpaid' : '',
    o && alarming.has(o.id) ? 'alarm' : '',
    selected ? 'sel' : '',
    editing ? 'editing' : '',
    t.name.length > 3 ? 'long' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<button class="${cls}" data-act="${editing ? 'editTable' : 'selectTable'}" data-id="${t.id}" aria-label="${esc(tableLabel(t.name))}">
    <span class="tbl-name">${esc(t.name)}</span><small>${sub}</small></button>`;
}

function tablesPanel(order, open) {
  const { data, ui } = store;
  const editing = ui.editTables;
  const known = new Set(data.tables.map((t) => t.id));
  // The first open order on each table owns its tile. Takeaways, orders on removed tables and a
  // second order on an occupied table (e.g. a recalled one) are listed below so none is hidden.
  const firstOpen = new Map();
  open.forEach((o) => {
    if (o.table != null && !firstOpen.has(o.table)) firstOpen.set(o.table, o);
  });
  const alarming = alarmingOrderIds();
  const others = open.filter((o) => o.table == null || !known.has(o.table) || firstOpen.get(o.table) !== o);
  const otherList = others
    .map(
      (o) =>
        `<button class="orow ${order?.id === o.id ? 'sel' : ''} ${isServed(o) && !isPaid(o) ? 'unpaid' : ''} ${alarming.has(o.id) ? 'alarm' : ''}" data-act="openOrder" data-id="${o.id}">
          <span>${esc(orderLabel(o))} <span class="muted">#${o.no}</span>${isPaid(o) ? ' <span class="pill paid">paid</span>' : ''}</span><b>${money(calcTotals(o).total)}</b></button>`,
    )
    .join('');

  const tiles = data.tables.map((t) => tableTile(t, firstOpen, order, editing, alarming)).join('');
  const addTile = editing
    ? '<button class="tbl add-tbl" data-act="addTable">+<small>Add table</small></button>'
    : '';
  const grid =
    tiles || addTile
      ? `<div class="tables">${tiles}${addTile}</div>`
      : '<div class="muted small">No tables yet. Tap <b>Edit tables</b> to add some.</div>';

  return `<section class="panel tables-panel">
    <div class="panel-h">
      <h2>Tables</h2>
      <div class="inrow"><span class="muted small">${open.length} open</span>
        <button class="small ${editing ? 'btn-primary' : ''}" data-act="toggleEditTables">${editing ? 'Done' : 'Edit tables'}</button></div>
    </div>
    <div class="panel-b scroll" data-keep="tables">
      ${editing ? '<div class="edit-hint">Tap a table to rename or remove it, or tap <b>+</b> to add one.</div>' : ''}
      ${grid}
      ${
        editing
          ? ''
          : `<button class="take-btn ${ui.pendingTable === 'take' ? 'sel' : ''}" data-act="newTakeaway">+ New takeaway</button>
             <div class="muted small take-hint">For food to go: no table needed.</div>`
      }
      ${others.length ? `<div class="sub">Takeaway &amp; other</div><div class="olist">${otherList}</div>` : ''}
    </div>
  </section>`;
}

function menuPanel() {
  const { data, ui } = store;
  const popular = popularItemIds(data).length ? [{ id: 'popular', name: '★ Popular' }] : [];
  if (ui.category === 'popular' && !popular.length) ui.category = 'all';
  const chips = [{ id: 'all', name: 'All' }, ...popular, ...data.categories]
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

function lineStatus(order, l) {
  const { unsent, cooking, ready } = lineKitchenStatus(order, l);
  const parts = [];
  if (unsent) parts.push(`<span class="lstat new">${unsent} not sent</span>`);
  if (cooking) parts.push(`<span class="lstat cooking">${cooking} cooking</span>`);
  if (ready) parts.push(`<span class="lstat ready">✓ ${ready} ready</span>`);
  return parts.length ? `<div class="lstats">${parts.join('')}</div>` : '';
}

function lineRow(order, l) {
  return `<div class="line">
    <div>
      <div class="nm">${esc(l.name)}${l.qty > l.sent ? '<span class="new-dot" title="Not yet sent to kitchen"></span>' : ''}</div>
      ${l.note ? `<div class="note">↳ ${esc(l.note)}</div>` : ''}
      ${lineStatus(order, l)}
      <div class="meta">${l.reward ? 'Free reward' : `${money(l.price)} each`} · <button class="linkbtn" data-act="editNote" data-id="${l.id}">${l.note ? 'Edit note' : 'Add note'}</button></div>
    </div>
    <div class="ln-side">
      <div class="qty">
        <button data-act="decreaseLine" data-id="${l.id}" aria-label="Remove one">−</button>
        <b>${l.qty}</b>
        <button data-act="increaseLine" data-id="${l.id}" aria-label="Add one" ${l.reward ? 'disabled' : ''}>+</button>
      </div>
      <div class="lt">${money(l.price * l.qty)}</div>
    </div>
  </div>`;
}

/** The regular customer on this order, with their stamp-card progress and any reward they can claim. */
function customerBar(order) {
  if (!order.customerId) {
    return `<div class="cust-bar"><button class="linkbtn" data-act="openCustomerDialog">+ Add customer</button>${order.customerName ? ` <span class="muted small">${esc(order.customerName)}</span>` : ''}</div>`;
  }
  const { data } = store;
  const customer = findCustomer(data, order.customerId);
  const visits = customerStats(data).get(order.customerId)?.visits || 0;
  const reward = customer && rewardStatus(customer, visits, Number(data.settings.loyaltyVisits) || 0);
  const hasReward = order.lines.some((l) => l.reward);
  let progress = '';
  if (reward && reward.due && !hasReward) {
    progress = `<button class="small btn-ok" data-act="redeemReward">Reward due: ${esc(data.settings.loyaltyReward || 'Reward')}</button>`;
  } else if (reward) {
    progress = `<span class="muted small">${reward.progress}/${reward.perReward} visits to a reward</span>`;
  }
  return `<div class="cust-bar">
    <span class="cust-name">👤 <b>${esc(order.customerName)}</b> <span class="muted small">${plural(visits, 'visit')}</span></span>
    ${progress}
    <button class="linkbtn" data-act="removeOrderCustomer" aria-label="Remove customer from this order">Remove</button>
  </div>`;
}

function ticketPanel(order) {
  if (!order) {
    const p = store.ui.pendingTable;
    const table = p && p !== 'take' ? findTable(store.data, p) : null;
    let title = 'Ticket';
    let hint = 'Select a table or start a takeaway.';
    if (p === 'take') {
      title = 'New takeaway';
      hint = 'Tap menu items to add them to this takeaway order.';
    } else if (table) {
      title = tableLabel(table.name);
      hint = 'Tap menu items to start this order.';
    }
    return `<div class="panel-h"><div class="tk-title">${esc(title)}</div></div><div class="scroll empty ${p ? 'ready' : ''}">${hint}</div>`;
  }
  const t = calcTotals(order);
  const unsent = unsentCount(order);
  const hasLines = order.lines.length > 0;
  const inKitchen = isInKitchen(order);
  const served = isServed(order);
  const paid = isPaid(order);
  const due = balanceDue(order);
  let status = '';
  let statusCls = '';
  if (served && !paid) {
    status = `All dishes served. Take payment of ${money(due)} before the customer leaves.`;
    statusCls = 'alert';
  } else if (paid && inKitchen) {
    status = `Paid. ${order.table ? 'The table frees' : 'The order completes'} when every dish is served.`;
    statusCls = 'ok';
  } else if (paid) {
    status = 'Paid. Send the dishes to the kitchen.';
    statusCls = 'ok';
  } else if (inKitchen && !unsent) {
    status = 'In the kitchen. You can take payment any time.';
  } else if (inKitchen) {
    status = 'Some dishes are in the kitchen. Send the new ones too.';
  } else if (order.paidAt && due) {
    status = `Items were added after payment. ${money(due)} still to pay.`;
    statusCls = 'alert';
  }
  const canWalkout = !paid && order.dishes?.length;

  return `<div class="panel-h">
      <div><div class="tk-title">${esc(orderLabel(order))}</div><div class="muted small">Order #${order.no} · ordered ${timeStr(order.createdAt)}${order.staff ? ` · ${esc(order.staff)}` : ''}</div></div>
      <div class="inrow">
        ${store.data.tables.length ? '<button class="small" data-act="moveOrder">Move</button>' : ''}
        <button class="small btn-danger" data-act="voidOrder">Void</button>
      </div>
    </div>
    ${customerBar(order)}
    <div class="scroll panel-b" data-keep="ticket">${hasLines ? order.lines.map((l) => lineRow(order, l)).join('') : '<div class="empty">No items yet.</div>'}</div>
    <div class="sum">
      <div class="row total"><span>Total</span><span>${money(t.total)}</span></div>
    </div>
    <div class="actions">
      ${status ? `<div class="status-note ${statusCls}">${status}${alarmingOrderIds().has(order.id) ? `<div><button class="small" data-act="snoozeAlarm" data-id="${order.id}">Customer still here · snooze alarm</button></div>` : ''}</div>` : ''}
      ${unsent || !served ? `<button class="btn-primary wide" data-act="sendToKitchen" ${unsent ? '' : 'disabled'}>Send to kitchen${unsent ? ` (${unsent})` : ''}</button>` : ''}
      ${!paid && hasLines ? `<button class="btn-ok wide" data-act="markPaid" data-id="${order.id}">Mark paid ${money(due)}</button>` : ''}
      <div class="action-row">
        <button data-act="printBill" ${hasLines ? '' : 'disabled'}>Print bill</button>
        ${canWalkout ? `<button class="btn-danger" data-act="markWalkout" data-id="${order.id}">Walked out</button>` : ''}
      </div>
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
