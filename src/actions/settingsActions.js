import { CASH } from '../config.js';
import { createSeedData, isBackup } from '../state/schema.js';
import { clearSelection, replaceData, save, store } from '../state/store.js';
import { audit } from '../ui/access.js';
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
    s.unpaidAlarmMinutes = Math.max(0, Math.min(120, parseInt($('#s-alarm-minutes').value, 10) || 0));
    s.alarmSound = $('#s-alarm-sound').checked;
    // "Card, Bank transfer" → ['Card', 'Bank transfer']; cash is always offered and isn't listed.
    s.otherPayments = [
      ...new Set(
        $('#s-payments')
          .value.split(',')
          .map((m) => m.trim())
          .filter((m) => m && m.toLowerCase() !== CASH.toLowerCase()),
      ),
    ].slice(0, 6);
    s.lowStock = Math.max(0, Math.min(999, parseInt($('#s-low-stock').value, 10) || 0));
    s.loyaltyVisits = Math.max(0, Math.min(100, parseInt($('#s-loyalty-visits').value, 10) || 0));
    s.loyaltyReward = $('#s-loyalty-reward').value.trim();
    save();
    render();
    toast('Settings saved');
  },
  exportBackup() {
    store.data.lastBackupAt = Date.now();
    save();
    render();
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
        'Delete all orders, sales history, cash drawer notes and the kitchen queue? Your menu, staff, customers and settings are kept (customer visits start again from zero). Export a backup first if you need the history.',
      confirmLabel: 'Clear',
      danger: true,
      onConfirm: () => {
        Object.assign(store.data, { orders: [], seq: 1, drawer: {} });
        store.data.customers.forEach((c) => {
          c.redeemed = 0;
        });
        audit('data', 'Cleared all orders and sales');
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
        store.ui.staffId = null;
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
