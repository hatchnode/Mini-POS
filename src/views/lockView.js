import { ROLE_LABEL } from '../domain/staff.js';
import { store } from '../state/store.js';
import { esc } from '../utils/text.js';

/** Shown instead of every screen while staff sign-in is on and nobody is signed in. */
export function renderLockView() {
  const people = store.data.staff
    .map(
      (s) =>
        `<button class="lock-user" data-act="signIn" data-id="${s.id}"><b>${esc(s.name)}</b><small>${ROLE_LABEL[s.role] || ''}</small></button>`,
    )
    .join('');
  return `<div class="lock">
    <h1>Who is working?</h1>
    <p class="muted">Tap your name, then enter your PIN.</p>
    <div class="lock-users">${people}</div>
    <button class="linkbtn" data-act="forgotPin">Forgot the manager PIN?</button>
  </div>`;
}
