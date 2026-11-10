import { PIN_LENGTH } from '../config.js';
import { closeButton, closeModal, openModal } from '../ui/modal.js';
import { $ } from '../utils/dom.js';
import { esc } from '../utils/text.js';

let pending = null;
let digits = '';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

function draw(error = '') {
  const dots = Array.from(
    { length: PIN_LENGTH },
    (_, i) => `<span class="${i < digits.length ? 'on' : ''}"></span>`,
  ).join('');
  const pad = KEYS.map((k) => {
    if (!k) return '<span></span>';
    return k === 'back'
      ? '<button data-act="pinKey" data-k="back" aria-label="Delete">⌫</button>'
      : `<button data-act="pinKey" data-k="${k}">${k}</button>`;
  }).join('');
  openModal(`
    <div class="mh"><h3>${esc(pending.title)}</h3>${closeButton}</div>
    <div class="mb pin">
      ${pending.hint ? `<p class="muted">${esc(pending.hint)}</p>` : ''}
      <div class="pin-dots ${error ? 'shake' : ''}" aria-label="${digits.length} of ${PIN_LENGTH} digits entered">${dots}</div>
      <div class="pin-error" role="alert">${esc(error)}</div>
      <div class="pin-pad">${pad}</div>
    </div>`);
}

/**
 * Ask for a PIN on a keypad. `check(pin)` returns something truthy when the PIN is right (it is
 * passed on to `onOk`), or a falsy value to ask again.
 */
export function openPinDialog({ title, hint = '', check, onOk }) {
  pending = { title, hint, check, onOk };
  digits = '';
  draw();
}

export const isPinDialogOpen = () => !!pending && !!$('#modal-root .pin-pad');

/** A keypad button or keyboard key: a digit, or 'back'. */
export function pinKey(key) {
  if (!isPinDialogOpen()) return;
  if (key === 'back') digits = digits.slice(0, -1);
  else if (digits.length < PIN_LENGTH) digits += key;
  if (digits.length < PIN_LENGTH) return draw();
  const result = pending.check(digits);
  if (!result) {
    digits = '';
    return draw('Wrong PIN. Try again.');
  }
  const { onOk } = pending;
  pending = null;
  closeModal();
  onOk(result);
}
