import { NOTE_PRESETS } from '../config.js';
import { setLineNote } from '../domain/orders.js';
import { currentOrder, save } from '../state/store.js';
import { closeButton, closeModal, openModal } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { $ } from '../utils/dom.js';
import { esc } from '../utils/text.js';

export function openNoteDialog(lineId) {
  const line = currentOrder()?.lines.find((l) => l.id === lineId);
  if (!line) return;
  const presets = NOTE_PRESETS.map(
    (p) => `<button data-act="appendNotePreset" data-v="${esc(p)}">${esc(p)}</button>`,
  ).join('');
  const sentWarning =
    line.sent > 0
      ? '<p class="muted small">Some of these were already sent to the kitchen. The note applies to anything sent from now on, so tell the kitchen about the change.</p>'
      : '';
  openModal(`
    <div class="mh"><h3>Note · ${esc(line.name)}</h3>${closeButton}</div>
    <div class="mb">
      <input id="note-input" value="${esc(line.note)}" placeholder="e.g. no onions, sauce on the side" maxlength="120">
      <div class="quick">${presets}</div>
      ${sentWarning}
    </div>
    <div class="mf"><button data-act="closeModal">Cancel</button><button class="btn-primary" data-act="saveNote" data-id="${line.id}">Save note</button></div>`);
  setTimeout(() => $('#note-input')?.focus(), 30);
}

export function appendNotePreset(text) {
  const input = $('#note-input');
  const current = input.value.trim();
  input.value = current ? `${current.replace(/[,\s]+$/, '')}, ${text}` : text;
  input.focus();
}

export function saveNote(lineId) {
  const order = currentOrder();
  if (order) {
    setLineNote(order, lineId, $('#note-input').value);
    save();
  }
  closeModal();
  render();
}
