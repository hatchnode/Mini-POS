import { $ } from '../utils/dom.js';
import { esc } from '../utils/text.js';

let pendingConfirm = null;

export const closeButton = '<button class="btn-ghost" data-act="closeModal" aria-label="Close">✕</button>';

export function openModal(html) {
  $('#modal-root').innerHTML =
    `<div class="backdrop" data-act="backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
}

export function closeModal() {
  $('#modal-root').innerHTML = '';
  pendingConfirm = null;
}

export const isModalOpen = () => !!$('#modal-root').firstElementChild;

/** Ask before doing something destructive. `onConfirm` runs only if the user agrees. */
export function confirmDialog({ message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  openModal(`
    <div class="mh"><h3>Are you sure?</h3></div>
    <div class="mb"><p>${esc(message)}</p></div>
    <div class="mf">
      <button data-act="closeModal">Cancel</button>
      <button class="${danger ? 'btn-dangerfill' : 'btn-primary'}" data-act="confirmModal">${esc(confirmLabel)}</button>
    </div>`);
  pendingConfirm = onConfirm;
}

export function runPendingConfirm() {
  const fn = pendingConfirm;
  closeModal();
  if (fn) fn();
}
