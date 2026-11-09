import { store } from '../state/store.js';
import { closeModal, runPendingConfirm } from '../ui/modal.js';
import { render } from '../ui/render.js';

export const click = {
  view(el) {
    store.ui.view = el.dataset.view;
    render();
    window.scrollTo(0, 0);
  },
  closeModal() {
    closeModal();
    render();
  },
  backdrop(el, e) {
    if (e.target !== el) return; // clicks inside the dialog bubble up here too
    closeModal();
    render();
  },
  confirmModal() {
    runPendingConfirm();
  },
};
