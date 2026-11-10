import { customerStats, searchCustomers } from '../domain/customers.js';
import { orderLabel } from '../domain/orders.js';
import { currentOrder, store } from '../state/store.js';
import { closeButton, openModal } from '../ui/modal.js';
import { $ } from '../utils/dom.js';
import { esc, plural } from '../utils/text.js';

/** Matching customers as tappable rows. Re-rendered alone while typing in the search box. */
export function customerResults(query) {
  const found = searchCustomers(store.data, query);
  if (!found.length) {
    return `<div class="muted small">${query.trim() ? 'No customer matches. Add them below.' : 'No customers yet. Add the first one below.'}</div>`;
  }
  const stats = customerStats(store.data);
  return found
    .map(
      (c) => `<button class="orow plain" data-act="pickCustomer" data-id="${c.id}">
        <span><b>${esc(c.name)}</b>${c.phone ? ` <span class="muted">${esc(c.phone)}</span>` : ''}</span>
        <span class="muted small">${plural(stats.get(c.id)?.visits || 0, 'visit')}</span></button>`,
    )
    .join('');
}

/** Put a regular customer on the current order: search by name or phone, or add a new one. */
export function openCustomerDialog() {
  const order = currentOrder();
  if (!order) return;
  openModal(`
    <div class="mh"><h3>Customer · ${esc(orderLabel(order))} #${order.no}</h3>${closeButton}</div>
    <div class="mb">
      <input id="cust-search" type="search" placeholder="Search by name or phone…" data-input="searchCustomer" aria-label="Search customers">
      <div class="olist" id="cust-results">${customerResults('')}</div>
      <hr>
      <form class="addcust" data-submit="addOrderCustomer">
        <input name="cname" placeholder="New customer name" required maxlength="60">
        <input name="cphone" type="tel" placeholder="Phone (optional)" maxlength="30">
        <button class="btn-primary">Add</button>
      </form>
    </div>`);
  setTimeout(() => $('#cust-search')?.focus(), 30);
}
