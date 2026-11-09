import { openOrders, orderLabel } from '../domain/orders.js';
import { currentOrder, store } from '../state/store.js';
import { closeButton, openModal } from '../ui/modal.js';
import { esc } from '../utils/text.js';

export function openMoveDialog() {
  const order = currentOrder();
  if (!order) return;
  const busy = new Set(openOrders(store.data).map((o) => o.table));
  let tables = '';
  for (let n = 1; n <= store.data.settings.tables; n++) {
    tables += `<button class="tbl" data-act="moveOrderTo" data-n="${n}" ${busy.has(n) ? 'disabled' : ''}>${n}</button>`;
  }
  openModal(`
    <div class="mh"><h3>Move ${esc(orderLabel(order))} to…</h3>${closeButton}</div>
    <div class="mb">
      ${tables ? `<div class="tables move">${tables}</div>` : ''}
      ${order.table != null ? '<button data-act="moveOrderTo" data-n="take">Make it a takeaway</button>' : ''}
    </div>`);
}
