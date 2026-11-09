import { findTable, isTableBusy, tableLabel } from '../domain/tables.js';
import { store } from '../state/store.js';
import { closeButton, openModal } from '../ui/modal.js';
import { $ } from '../utils/dom.js';
import { esc } from '../utils/text.js';

/** Rename or remove a table (Orders screen, Edit tables mode). */
export function openTableDialog(tableId) {
  const table = findTable(store.data, tableId);
  if (!table) return;
  const busy = isTableBusy(store.data, tableId);
  openModal(`
    <div class="mh"><h3>${esc(tableLabel(table.name))}</h3>${closeButton}</div>
    <div class="mb">
      <label class="fld">Table name
        <input id="table-name" value="${esc(table.name)}" maxlength="20" placeholder="e.g. 7, Patio, Bar 2">
      </label>
      <p class="muted small">Numbers show as “Table 7”. Any other name is shown as typed.</p>
      ${busy ? '<p class="muted small">This table has an open order, so it can’t be removed right now.</p>' : ''}
    </div>
    <div class="mf spread">
      <button class="btn-danger" data-act="removeTable" data-id="${table.id}" ${busy ? 'disabled' : ''}>Remove table</button>
      <div class="inrow">
        <button data-act="closeModal">Cancel</button>
        <button class="btn-primary" data-act="saveTable" data-id="${table.id}">Save</button>
      </div>
    </div>`);
  setTimeout(() => {
    const input = $('#table-name');
    if (input) {
      input.focus();
      input.select();
    }
  }, 30);
}
