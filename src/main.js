import './styles/index.css';

import { handlers } from './actions/index.js';
import { isPinDialogOpen, pinKey } from './components/pinDialog.js';
import { STORAGE_KEY } from './config.js';
import { onSaveError, replaceData, store } from './state/store.js';
import { startClock } from './ui/clock.js';
import { bindEvents } from './ui/events.js';
import { closeModal, isModalOpen } from './ui/modal.js';
import { render } from './ui/render.js';
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

startClock();
render();
