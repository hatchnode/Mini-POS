import { MANAGER_VIEWS } from '../domain/staff.js';
import { store } from '../state/store.js';
import { canManage } from '../ui/access.js';
import { closeModal, runPendingConfirm } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

export const click = {
  view(el) {
    if (!canManage() && MANAGER_VIEWS.includes(el.dataset.view)) {
      toast('That screen is for managers');
      return;
    }
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
