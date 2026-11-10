import { CASH } from '../config.js';
import { backupFiles, dataFromFiles } from '../domain/backup.js';
import {
  folder,
  forgetFolder,
  pickFolder,
  readFolderFiles,
  resumeFolder,
  saveToFolderNow,
  useFolder,
} from '../state/folder.js';
import { createSeedData, isBackup } from '../state/schema.js';
import { clearSelection, replaceData, save, store } from '../state/store.js';
import { audit } from '../ui/access.js';
import { closeButton, closeModal, confirmDialog, openModal } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';
import { dateTimeStr, todayStr } from '../utils/date.js';
import { downloadFile, readFileBytes, readFileText } from '../utils/file.js';
import { esc, plural } from '../utils/text.js';
import { unzipFiles, zipFiles } from '../utils/zip.js';

const currentFiles = () => backupFiles(store.data);

/** "214 orders and 18 menu items", to help tell two sets of data apart. */
const describe = (data) =>
  `${plural((data.orders || []).length, 'order')} and ${plural((data.items || []).length, 'menu item')}`;

/** A folder picked in "Choose folder" that already holds data, while the user decides which to keep. */
let pendingFolder = null;

/** Remember the folder and write the current data to it straight away. */
async function startUsing(dir) {
  try {
    await useFolder(dir);
    await saveToFolderNow(currentFiles);
  } catch (error) {
    toast(`Could not use that folder: ${error.message}`, 3500);
  }
  save();
  render();
}

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
    // "Bank transfer, Voucher" → ['Bank transfer', 'Voucher']; cash is always offered and isn't listed.
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
  /** Download everything as one ZIP of CSV files. */
  exportBackup() {
    store.data.lastBackupAt = Date.now();
    save();
    render();
    downloadFile(`mini-pos-backup-${todayStr()}.zip`, zipFiles(currentFiles()), 'application/zip');
  },
  importBackup() {
    $('#import-file').click();
  },

  /** Pick a folder on the computer to keep a copy of the data in, as CSV files. */
  async chooseFolder() {
    let dir;
    try {
      dir = await pickFolder();
    } catch (error) {
      return toast(`Could not open that folder: ${error.message}`, 3500);
    }
    if (!dir) return;
    const found = dataFromFiles(await readFolderFiles(dir).catch(() => []));
    if (!found.ok) {
      await startUsing(dir);
      return toast(`Saving to the folder “${dir.name}”`);
    }
    // The folder already holds Mini-POS data: don't overwrite it, or this device's data, without asking.
    pendingFolder = { dir, data: found.data };
    openModal(`
      <div class="mh"><h3>This folder already has Mini-POS data</h3>${closeButton}</div>
      <div class="mb">
        <p>“${esc(dir.name)}” contains ${describe(found.data)}${found.savedAt ? `, saved ${dateTimeStr(found.savedAt)}` : ''}.</p>
        <p>This device has ${describe(store.data)}.</p>
        <p class="muted">Which one do you want to keep? The other is replaced.</p>
      </div>
      <div class="mf wrap">
        <button data-act="closeModal">Cancel</button>
        <button class="btn-primary" data-act="folderKeepFolder">Keep the folder’s data</button>
        <button class="btn-dangerfill" data-act="folderKeepDevice">Keep this device’s data</button>
      </div>`);
  },
  async folderKeepFolder() {
    if (!pendingFolder) return;
    const { dir, data } = pendingFolder;
    pendingFolder = null;
    closeModal();
    replaceData(data);
    await startUsing(dir);
    toast(`Loaded the data from “${dir.name}”`);
  },
  async folderKeepDevice() {
    if (!pendingFolder) return;
    const { dir } = pendingFolder;
    pendingFolder = null;
    closeModal();
    await startUsing(dir);
    toast(`Saving to the folder “${dir.name}”`);
  },
  /** Replace what is in the browser with what is in the folder (e.g. after clearing browser data). */
  loadFromFolder() {
    confirmDialog({
      message: `Replace all data on this device with the files in the folder “${folder.name}”?`,
      confirmLabel: 'Load from folder',
      danger: true,
      onConfirm: async () => {
        const found = dataFromFiles(await readFolderFiles().catch(() => []));
        if (!found.ok) return toast(found.error, 3500);
        replaceData(found.data);
        save();
        render();
        toast('Loaded the data from the folder');
      },
    });
  },
  stopFolder() {
    confirmDialog({
      message: `Stop saving to the folder “${folder.name}”? The files already there are left as they are.`,
      confirmLabel: 'Stop saving',
      onConfirm: async () => {
        await forgetFolder();
        render();
        toast('No longer saving to a folder');
      },
    });
  },
  /** Banner button: the browser needs a click before it lets the app write to the folder again. */
  async resumeFolder() {
    if (await resumeFolder()) {
      await saveToFolderNow(currentFiles);
      toast(`Saving to the folder “${folder.name}” again`);
    } else toast('The browser did not allow access to the folder');
    render();
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
  /** Restore a backup: the ZIP, or the CSV files picked together. (Old JSON backups still load.) */
  async importFile(el) {
    const files = [...(el.files || [])];
    el.value = '';
    if (!files.length) return;
    const named = (ext) => files.find((f) => f.name.toLowerCase().endsWith(ext));
    let result;
    try {
      if (named('.zip')) result = dataFromFiles(await unzipFiles(await readFileBytes(named('.zip'))));
      else if (named('.json')) {
        const raw = JSON.parse(await readFileText(named('.json')));
        result = isBackup(raw)
          ? { ok: true, data: raw }
          : { ok: false, error: 'That file is not a Mini-POS backup' };
      } else {
        result = dataFromFiles(
          await Promise.all(files.map(async (f) => ({ name: f.name, text: await readFileText(f) }))),
        );
      }
    } catch {
      result = { ok: false, error: 'That file could not be read as a Mini-POS backup' };
    }
    if (!result.ok) return toast(result.error, 3500);
    confirmDialog({
      message: `Replace all current data with this backup (${describe(result.data)}${result.savedAt ? `, saved ${dateTimeStr(result.savedAt)}` : ''})?`,
      confirmLabel: 'Restore',
      danger: true,
      onConfirm: () => {
        replaceData(result.data);
        save();
        render();
        toast('Backup restored');
      },
    });
  },
};
