import './styles/index.css';

import { handlers } from './actions/index.js';
import { isPinDialogOpen, pinKey } from './components/pinDialog.js';
import { STORAGE_KEY } from './config.js';
import { backupFiles } from './domain/backup.js';
import { initFolder, onFolderChange, scheduleFolderSave } from './state/folder.js';
import { detectServer, onServerEvent, scheduleSync } from './state/server.js';
import { onSave, onSaveError, replaceData, store } from './state/store.js';
import { renderFolderStatus } from './ui/folderStatus.js';
import { startClock } from './ui/clock.js';
import { bindEvents } from './ui/events.js';
import { closeModal, isModalOpen } from './ui/modal.js';
import { render, renderServerBanner } from './ui/render.js';
import { toast } from './ui/toast.js';
import { unlockAudio } from './ui/sound.js';
import { $ } from './utils/dom.js';

onSaveError(() => {
  $('#storage-banner').hidden = false;
  toast('Could not save: browser storage is full or blocked');
});

bindEvents(handlers, {
  onKeydown(e) {
    if (e.key === 'Escape' && isModalOpen()) {
      closeModal();
      render();
    }
    if (isPinDialogOpen() && (/^\d$/.test(e.key) || e.key === 'Backspace')) {
      e.preventDefault();
      pinKey(e.key === 'Backspace' ? 'back' : e.key);
    }
    if (e.key === 'Enter' && e.target.id === 'note-input') {
      e.preventDefault();
      $('[data-act=saveNote]')?.click();
    }
    if (e.key === 'Enter' && e.target.id === 'table-name') {
      e.preventDefault();
      $('[data-act=saveTable]')?.click();
    }
  },
});

// Keep two tabs on the same device in sync.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue || isModalOpen()) return;
  const { currentOrderId, pendingTable, category } = store.ui;
  replaceData(JSON.parse(e.newValue));
  Object.assign(store.ui, { currentOrderId, pendingTable, category });
  render();
});

// Browsers only allow sound after the first tap or key press.
['pointerdown', 'keydown'].forEach((type) => document.addEventListener(type, unlockAudio, { once: true }));

// Ask the browser not to clear this site's data when the device runs low on space.
navigator.storage?.persist?.().catch(() => {});

// In the built app, a service worker keeps a copy of the app so it opens with no internet.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Keep the data folder (if one was chosen in Settings) up to date with every change.
onFolderChange(renderFolderStatus);
onSave(() => scheduleFolderSave(() => backupFiles(store.data)));
initFolder().then(() => scheduleFolderSave(() => backupFiles(store.data)));

// When the app is served by a Mini-POS server: connect, then keep in step with the other devices.
const typing = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
onServerEvent({
  change: () => (isModalOpen() || typing() ? renderServerBanner() : render()),
  // Don't redraw under someone who is typing or in a dialog; the next action redraws anyway.
  applied: () => (isModalOpen() || typing() ? null : render()),
  rejected: (list) => {
    const real = list.filter((r) => !['settings', 'meta'].includes(r.collection));
    if (real.length) toast(`Not saved: ${real[0].reason.toLowerCase()}`, 3500);
    if (!isModalOpen()) render();
  },
});
onSave(() => scheduleSync());
detectServer();

startClock();
render();
