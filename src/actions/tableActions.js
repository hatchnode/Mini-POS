import { openTableDialog } from '../components/tableDialog.js';
import { addTable, findTable, removeTable, renameTable, tableLabel } from '../domain/tables.js';
import { save, store } from '../state/store.js';
import { withManager } from '../ui/access.js';
import { closeModal, confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';

export const click = {
  toggleEditTables() {
    if (store.ui.editTables) {
      store.ui.editTables = false;
      return render();
    }
    withManager('add, rename or remove tables', () => {
      store.ui.editTables = true;
      render();
    });
  },
  addTable() {
    const result = addTable(store.data);
    if (!result.ok) return toast(result.error);
    save();
    render();
    toast(`Added ${tableLabel(result.table.name)}`);
  },
  editTable: (el) => openTableDialog(el.dataset.id),
  saveTable(el) {
    const result = renameTable(store.data, el.dataset.id, $('#table-name').value);
    if (!result.ok) return toast(result.error);
    save();
    closeModal();
    render();
    toast(`Saved ${tableLabel(result.table.name)}`);
  },
  removeTable(el) {
    const table = findTable(store.data, el.dataset.id);
    if (!table) return;
    confirmDialog({
      message: `Remove ${tableLabel(table.name)}? Past orders from this table are kept.`,
      confirmLabel: 'Remove table',
      danger: true,
      onConfirm: () => {
        const result = removeTable(store.data, table.id);
        if (!result.ok) return toast(result.error);
        if (store.ui.pendingTable === table.id) store.ui.pendingTable = null;
        save();
        render();
        toast(`Removed ${tableLabel(table.name)}`);
      },
    });
  },
};
