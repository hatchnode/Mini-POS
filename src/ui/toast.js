import { $ } from '../utils/dom.js';

let timer;

export function toast(message, ms = 1900) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), ms);
}
