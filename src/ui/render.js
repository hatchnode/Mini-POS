import { pendingDishCount } from '../domain/kitchen.js';
import { MANAGER_VIEWS } from '../domain/staff.js';
import { currentStaff, store } from '../state/store.js';
import { canManage, isLocked } from './access.js';
import { renderAlarmBanner } from './alarm.js';
import { renderFolderStatus } from './folderStatus.js';
import { $, $$ } from '../utils/dom.js';
import { renderKitchenView } from '../views/kitchenView.js';
import { renderLockView } from '../views/lockView.js';
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
  // With staff sign-in on: nobody signed in sees only the lock screen, and staff who aren't
  // managers don't get the Sales, Menu and Settings screens.
  const locked = isLocked();
  const manage = canManage();
  if (!manage && MANAGER_VIEWS.includes(ui.view)) ui.view = 'orders';
  $$('nav button').forEach((b) => {
    b.classList.toggle('on', b.dataset.view === ui.view);
    b.hidden = locked || (!manage && MANAGER_VIEWS.includes(b.dataset.view));
  });
  const chip = $('#staff-chip');
  chip.hidden = !currentStaff();
  chip.textContent = currentStaff() ? `${currentStaff().name} · Lock` : '';
  const waiting = pendingDishCount(data);
  const badge = $('#kitchen-badge');
  badge.textContent = waiting;
  badge.hidden = !waiting;
  $('#storage-banner').hidden = store.storageOK;

  $('#app').innerHTML = locked ? renderLockView() : (VIEWS[ui.view] || renderOrdersView)();
  renderAlarmBanner();
  renderFolderStatus();

  $$('[data-keep]').forEach((el) => {
    if (scroll[el.dataset.keep] != null) el.scrollTop = scroll[el.dataset.keep];
  });
}
