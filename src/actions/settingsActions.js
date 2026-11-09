import { createSeedData, isBackup } from '../state/schema.js';
import { clearSelection, replaceData, save, store } from '../state/store.js';
import { confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';
import { todayStr } from '../utils/date.js';
import { downloadText, readFileText } from '../utils/file.js';

export const click = {
  saveSettings() {
    const s = store.data.settings;
    s.name = $('#s-name').value.trim() || 'My Restaurant';
    s.address = $('#s-address').value.trim();
    s.phone = $('#s-phone').value.trim();
    s.currency = $('#s-currency').value;
    s.footer = $('#s-footer').value.trim();
    save();
    render();
    toast('Settings saved');
  },
  exportBackup() {
    downloadText(
      `mini-pos-backup-${todayStr()}.json`,
      JSON.stringify(store.data, null, 2),
      'application/json',
    );
  },
  importBackup() {
    $('#import-file').click();
  },
  clearOrders() {
    confirmDialog({
      message:
        'Delete all orders, sales history and the kitchen queue? Your menu and settings are kept. Export a backup first if you need the history.',
      confirmLabel: 'Clear',
      danger: true,
      onConfirm: () => {
        Object.assign(store.data, { orders: [], seq: 1 });
        clearSelection();
        save();
        render();
        toast('Orders cleared');
      },
    });
  },
  resetAll() {
    confirmDialog({
      message:
        'Reset everything to the sample menu? All orders, sales, menu items and settings will be deleted.',
      confirmLabel: 'Reset',
      danger: true,
      onConfirm: () => {
        replaceData(createSeedData());
        save();
        render();
        toast('Reset complete');
      },
    });
  },
};

export const change = {
  async importFile(el) {
    const file = el.files?.[0];
    if (!file) return;
    el.value = '';
    let raw;
    try {
      raw = JSON.parse(await readFileText(file));
    } catch {
      raw = null;
    }
    if (!isBackup(raw)) {
      toast('That file is not a Mini-POS backup');
      return;
    }
    confirmDialog({
      message: `Replace all current data with the backup "${file.name}"?`,
      confirmLabel: 'Restore',
      danger: true,
      onConfirm: () => {
        replaceData(raw);
        save();
        render();
        toast('Backup restored');
      },
    });
  },
};
