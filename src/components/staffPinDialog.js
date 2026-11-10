import { PIN_LENGTH } from '../config.js';
import { findStaff } from '../domain/staff.js';
import { store } from '../state/store.js';
import { closeButton, openModal } from '../ui/modal.js';
import { $ } from '../utils/dom.js';
import { esc } from '../utils/text.js';

/** Markup for a PIN box: digits only, hidden as typed. */
export const pinInput = (attrs) =>
  `<input ${attrs} type="password" inputmode="numeric" autocomplete="off" pattern="\\d{${PIN_LENGTH}}" maxlength="${PIN_LENGTH}" placeholder="${PIN_LENGTH} digits">`;

/** Settings: set a new PIN for a staff member. */
export function openStaffPinDialog(staffId) {
  const member = findStaff(store.data, staffId);
  if (!member) return;
  openModal(`
    <div class="mh"><h3>New PIN · ${esc(member.name)}</h3>${closeButton}</div>
    <div class="mb">
      <label class="fld">New PIN${pinInput('id="staff-pin"')}</label>
    </div>
    <div class="mf">
      <button data-act="closeModal">Cancel</button>
      <button class="btn-primary" data-act="saveStaffPin" data-id="${member.id}">Save PIN</button>
    </div>`);
  setTimeout(() => $('#staff-pin')?.focus(), 30);
}
