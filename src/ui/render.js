import { pendingDishCount } from '../domain/kitchen.js';
import { MANAGER_VIEWS } from '../domain/staff.js';
import { server } from '../state/server.js';
import { currentStaff, store } from '../state/store.js';
import { canManage, isLocked } from './access.js';
import { renderAlarmBanner } from './alarm.js';
import { renderFolderStatus } from './folderStatus.js';
import { $, $$ } from '../utils/dom.js';
import { renderConnectView } from '../views/connectView.js';
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
  // With a server, a device shows nothing until it is connected with the owner password.
  const waiting = server.mode === 'server' && server.phase !== 'ready';
  const locked = waiting || isLocked();
  const manage = canManage();
  if (!manage && MANAGER_VIEWS.includes(ui.view)) ui.view = 'orders';
  $$('nav button').forEach((b) => {
    b.classList.toggle('on', b.dataset.view === ui.view);
    b.hidden = locked || (!manage && MANAGER_VIEWS.includes(b.dataset.view));
  });
  const chip = $('#staff-chip');
  chip.hidden = !currentStaff();
  chip.textContent = currentStaff() ? `${currentStaff().name} · Lock` : '';
  const cooking = pendingDishCount(data);
  const badge = $('#kitchen-badge');
  badge.textContent = cooking;
  badge.hidden = !cooking;
  $('#storage-banner').hidden = store.storageOK;

  let html;
  if (waiting) html = renderConnectView();
  else if (locked) html = renderLockView();
  else html = (VIEWS[ui.view] || renderOrdersView)();
  $('#app').innerHTML = html;
  renderServerBanner();
  renderAlarmBanner();
  renderFolderStatus();

  $$('[data-keep]').forEach((el) => {
    if (scroll[el.dataset.keep] != null) el.scrollTop = scroll[el.dataset.keep];
  });
}

/** While the server can't be reached: say so, and that work is being kept on this device. */
export function renderServerBanner() {
  const el = $('#server-banner');
  const offline = server.mode === 'server' && server.phase === 'ready' && !server.online;
  el.hidden = !offline;
  el.textContent = offline
    ? `No connection to the server. You can keep working: changes are kept on this device and sent when it is back${server.pending ? ` (${server.pending} waiting)` : ''}.`
    : '';
}
