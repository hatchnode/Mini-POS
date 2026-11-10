import { pinInput } from '../components/staffPinDialog.js';
import { recentLog } from '../domain/log.js';
import { ROLE_LABEL } from '../domain/staff.js';
import { store } from '../state/store.js';
import { dateTimeStr, timeAgo } from '../utils/date.js';
import { esc } from '../utils/text.js';

const roleOptions = (selected) =>
  Object.entries(ROLE_LABEL)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`,
    )
    .join('');

function staffPanel() {
  const { staff } = store.data;
  const rows = staff
    .map(
      (m) => `<tr>
        <td><b>${esc(m.name)}</b>${m.id === store.ui.staffId ? ' <span class="muted small">(you)</span>' : ''}</td>
        <td><select data-change="setStaffRole" data-id="${m.id}" aria-label="Role">${roleOptions(m.role)}</select></td>
        <td class="acts">
          <button class="small" data-act="changeStaffPin" data-id="${m.id}">New PIN</button>
          <button class="small btn-danger" data-act="removeStaff" data-id="${m.id}">Remove</button>
        </td></tr>`,
    )
    .join('');
  const intro = staff.length
    ? 'Staff sign in with their name and PIN. Voids, walk-outs, removing dishes already sent to the kitchen, and the Sales, Menu and Settings screens need a manager (or a manager’s PIN).'
    : 'Optional. Add yourself first (you become the manager) to make everyone sign in with a PIN. Until then, anyone can use every screen.';
  return `<section class="panel"><div class="panel-h"><h2>Staff &amp; PINs</h2><span class="muted small">${staff.length ? `${staff.length} · sign-in on` : 'sign-in off'}</span></div>
    <div class="panel-b form">
      <p class="muted flush">${intro}</p>
      <form class="addstaff" data-submit="addStaff">
        <input name="sname" placeholder="Name" required maxlength="30">
        ${pinInput('name="spin" required aria-label="PIN"')}
        <select name="srole" aria-label="Role">${roleOptions(staff.length ? 'staff' : 'manager')}</select>
        <button class="btn-primary">Add</button>
      </form>
    </div>
    ${rows ? `<div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Role</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    <div class="panel-b"><p class="muted small flush">PINs deter casual misuse on a shared tablet; they are not strong security.</p></div>
  </section>`;
}

function logPanel() {
  const entries = recentLog(store.data, 60);
  const rows = entries
    .map(
      (e) =>
        `<tr><td class="nowrap">${dateTimeStr(e.at)}</td><td>${esc(e.staff || '—')}</td><td>${esc(e.text)}</td></tr>`,
    )
    .join('');
  return `<section class="panel"><div class="panel-h"><h2>Activity log</h2><span class="muted small">voids, walk-outs, removed dishes, staff changes</span></div>
    ${
      rows
        ? `<div class="tablewrap log"><table class="t"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<div class="empty">Nothing recorded yet.</div>'
    }
  </section>`;
}

/** Whether this copy of the app has been saved on the device so it opens offline. */
function offlineNote() {
  if (!('serviceWorker' in navigator)) return 'not supported in this browser';
  return navigator.serviceWorker.controller
    ? 'yes, the app is saved on this device'
    : 'not yet. Open the app once more while online to finish saving it.';
}

export function renderSettingsView() {
  const { data, storageOK } = store;
  const s = data.settings;
  const storageNote = storageOK
    ? 'saving in this browser'
    : '<b class="bad">not available</b>, data will be lost on reload';

  return `<div class="page"><div class="page-top"><h1>Settings</h1></div><div class="two even">
    <section class="panel"><div class="panel-h"><h2>Restaurant</h2></div><div class="panel-b form">
      <label class="fld">Name<input id="s-name" value="${esc(s.name)}"></label>
      <label class="fld">Location (printed on receipts)<input id="s-address" value="${esc(s.address)}" placeholder="e.g. 12 Main St, Springfield"></label>
      <label class="fld">Phone (printed on receipts)<input id="s-phone" type="tel" value="${esc(s.phone)}" placeholder="e.g. (555) 123-4567"></label>
      <div class="grid2">
        <label class="fld">Currency symbol<input id="s-currency" value="${esc(s.currency)}" maxlength="4"></label>
        <div class="fld">Tables<div class="muted small settings-note">Add, rename or remove tables on the Orders screen with <b>Edit tables</b>. You have ${data.tables.length}.</div></div>
      </div>
      <div class="grid2">
        <label class="fld">Unpaid alarm after (minutes)
          <input id="s-alarm-minutes" type="number" min="0" max="120" value="${Number(s.unpaidAlarmMinutes) || 0}">
          <span class="muted small settings-note">A served table still unpaid this long flashes, shows a banner and beeps. 0 turns it off.</span>
        </label>
        <label class="fld">Alarm sound
          <span class="inrow"><input id="s-alarm-sound" type="checkbox" ${s.alarmSound ? 'checked' : ''}> <span class="settings-note">Play a sound</span></span>
        </label>
      </div>
      <div class="grid2">
        <label class="fld">Other ways to pay
          <input id="s-payments" value="${esc((s.otherPayments || []).join(', '))}" placeholder="Cash only">
          <span class="muted small settings-note">Cash is always offered. List the others separated by commas, or leave blank for cash only.</span>
        </label>
        <label class="fld">Low stock warning at
          <input id="s-low-stock" type="number" min="0" max="999" value="${Number(s.lowStock) || 0}">
          <span class="muted small settings-note">Items you count (Menu → Left) show as low at this many portions.</span>
        </label>
      </div>
      <div class="grid2">
        <label class="fld">Reward after (paid visits)
          <input id="s-loyalty-visits" type="number" min="0" max="100" value="${Number(s.loyaltyVisits) || 0}">
          <span class="muted small settings-note">For customers added to orders. 0 turns rewards off.</span>
        </label>
        <label class="fld">The reward
          <input id="s-loyalty-reward" value="${esc(s.loyaltyReward)}" maxlength="40" placeholder="e.g. Free drink">
        </label>
      </div>
      <label class="fld">Receipt footer<input id="s-footer" value="${esc(s.footer)}"></label>
      <div><button class="btn-primary" data-act="saveSettings">Save settings</button></div>
    </div></section>
    <section class="panel"><div class="panel-h"><h2>Data</h2></div><div class="panel-b form">
      <p class="muted flush">Everything is stored in this browser on this device. Export a backup regularly, and before clearing browser data.</p>
      <div class="inrow wrap">
        <button data-act="exportBackup">Export backup</button>
        <button data-act="importBackup">Import backup</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden data-change="importFile">
      </div>
      <hr>
      <div class="inrow wrap">
        <button class="btn-danger" data-act="clearOrders">Clear orders &amp; sales</button>
        <button class="btn-danger" data-act="resetAll">Reset everything</button>
      </div>
      <p class="muted small flush">Storage: ${storageNote} · ${data.orders.length} orders stored</p>
      <p class="muted small flush">Last backup: ${data.lastBackupAt ? `${dateTimeStr(data.lastBackupAt)} (${timeAgo(data.lastBackupAt)})` : '<b class="bad">never</b>. Export one now and keep it somewhere safe.'}</p>
      <p class="muted small flush">Works with no internet: ${offlineNote()}</p>
    </div></section>
  </div><div class="two even">${staffPanel()}${logPanel()}</div></div>`;
}
