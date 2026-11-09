import { MAX_TABLES } from '../config.js';
import { store } from '../state/store.js';
import { esc } from '../utils/text.js';

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
        <label class="fld">Tables<input id="s-tables" type="number" min="0" max="${MAX_TABLES}" value="${s.tables}"></label>
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
    </div></section>
  </div></div>`;
}
