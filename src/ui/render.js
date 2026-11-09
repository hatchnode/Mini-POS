import { store } from '../state/store.js';
import { $, $$ } from '../utils/dom.js';
import { renderKitchenView } from '../views/kitchenView.js';
import { renderMenuView } from '../views/menuView.js';
import { renderOrdersView } from '../views/ordersView.js';
import { renderSalesView } from '../views/salesView.js';
import { renderSettingsView } from '../views/settingsView.js';

const VIEWS = {
  orders: renderOrdersView,
  kitchen: renderKitchenView,
  sales: renderSalesView,
  menu: renderMenuView,
  settings: renderSettingsView,
};

/** Re-render the header and the active view from the store. Scroll positions marked `data-keep` survive. */
export function render() {
  const { data, ui } = store;
  const scroll = {};
  $$('[data-keep]').forEach((el) => {
    scroll[el.dataset.keep] = el.scrollTop;
  });

  document.title = `${data.settings.name} · Mini-POS`;
  $('#brand-name').textContent = data.settings.name;
  $$('nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === ui.view));
  const waiting = data.tickets.filter((t) => !t.done).length;
  const badge = $('#kitchen-badge');
  badge.textContent = waiting;
  badge.hidden = !waiting;
  $('#storage-banner').hidden = store.storageOK;

  $('#app').innerHTML = (VIEWS[ui.view] || renderOrdersView)();

  $$('[data-keep]').forEach((el) => {
    if (scroll[el.dataset.keep] != null) el.scrollTop = scroll[el.dataset.keep];
  });
}
