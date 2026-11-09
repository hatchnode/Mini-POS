import './styles/index.css';

import { handlers } from './actions/index.js';
import { STORAGE_KEY } from './config.js';
import { onSaveError, replaceData, store } from './state/store.js';
import { startClock } from './ui/clock.js';
import { bindEvents } from './ui/events.js';
import { closeModal, isModalOpen } from './ui/modal.js';
import { render } from './ui/render.js';
import { toast } from './ui/toast.js';
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
    if (e.key === 'Enter' && e.target.id === 'note-input') {
      e.preventDefault();
      $('[data-act=saveNote]')?.click();
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

startClock();
render();
