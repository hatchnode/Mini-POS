import { openOrders, orderLabel } from '../domain/orders.js';
import { currentOrder, store } from '../state/store.js';
import { closeButton, openModal } from '../ui/modal.js';
import { esc } from '../utils/text.js';

export function openMoveDialog() {
  const order = currentOrder();
  if (!order) return;
  const busy = new Set(openOrders(store.data).map((o) => o.table));
  const tables = store.data.tables
    .map(
      (t) =>
        `<button class="tbl ${t.name.length > 3 ? 'long' : ''}" data-act="moveOrderTo" data-id="${t.id}" ${busy.has(t.id) ? 'disabled' : ''}>${esc(t.name)}</button>`,
    )
    .join('');
  openModal(`
    <div class="mh"><h3>Move ${esc(orderLabel(order))} to…</h3>${closeButton}</div>
    <div class="mb">
      ${tables ? `<div class="tables move">${tables}</div>` : ''}
      ${order.table != null ? '<button data-act="moveOrderTo" data-id="take">Make it a takeaway</button>' : ''}
    </div>`);
}
