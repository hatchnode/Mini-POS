import { openPinDialog, pinKey } from '../components/pinDialog.js';
import { openStaffPinDialog } from '../components/staffPinDialog.js';
import { logEvent } from '../domain/log.js';
import {
  ROLE_LABEL,
  addStaff,
  checkPin,
  findStaff,
  removeStaff,
  setStaffPin,
  setStaffRole,
} from '../domain/staff.js';
import { server, signIn, signOut, staffApi } from '../state/server.js';
import { clearSelection, save, store } from '../state/store.js';
import { audit } from '../ui/access.js';
import { closeButton, closeModal, confirmDialog, openModal } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';

const onServer = () => server.mode === 'server';

/** Staff changes: made on the server when there is one, otherwise in this browser. */
async function apply(viaServer, locally) {
  const result = onServer() ? await viaServer() : locally();
  if (!result.ok) toast(result.error, 3500);
  return result;
}

export const click = {
  /** Lock screen: pick a name, then enter that person's PIN. */
  signIn(el) {
    const member = findStaff(store.data, el.dataset.id);
    if (!member) return;
    openPinDialog({
      title: `Hi ${member.name}`,
      hint: 'Enter your PIN.',
      check: async (pin) => {
        if (!onServer()) return checkPin(member, pin) && member;
        const result = await signIn(member.id, pin);
        return result.ok ? member : { error: result.error };
      },
      onOk: () => {
        store.ui.staffId = member.id;
        render();
        toast(`Signed in as ${member.name}`);
      },
    });
  },
  lockApp() {
    if (onServer()) signOut();
    store.ui.staffId = null;
    store.ui.editTables = false;
    clearSelection();
    closeModal();
    render();
  },
  pinKey: (el) => pinKey(el.dataset.k),
  /** The way back in when the manager PIN is lost. It is recorded, so it can't be done quietly. */
  forgotPin() {
    if (onServer()) {
      // With a server, only the owner password can turn staff sign-in off.
      openModal(`
        <div class="mh"><h3>Forgot the manager PIN?</h3>${closeButton}</div>
        <form data-submit="resetStaff">
          <div class="mb">
            <p>Enter the owner password to remove everyone from the staff list and turn staff sign-in off. You can then add staff again with new PINs. This is recorded in the activity log.</p>
            <label class="fld">Owner password<input name="password" type="password" autocomplete="current-password" required></label>
            <div class="connect-error" id="connect-error" role="alert"></div>
          </div>
          <div class="mf"><button type="button" data-act="closeModal">Cancel</button><button class="btn-dangerfill">Remove all PINs</button></div>
        </form>`);
      return;
    }
    confirmDialog({
      message:
        'Turn off staff sign-in? Everyone on the staff list and their PINs will be removed, and anyone will be able to use every screen until you add staff again. This is recorded in the activity log.',
      confirmLabel: 'Remove all PINs',
      danger: true,
      onConfirm: () => {
        store.data.staff = [];
        store.ui.staffId = null;
        logEvent(store.data, 'staff', 'Staff sign-in was reset from the lock screen (forgot PIN)');
        save();
        render();
        toast('Staff sign-in is off. Add staff again in Settings.');
      },
    });
  },
  changeStaffPin: (el) => openStaffPinDialog(el.dataset.id),
  async saveStaffPin(el) {
    const pin = $('#staff-pin').value;
    const result = await apply(
      () => staffApi.setPin(el.dataset.id, pin),
      () => setStaffPin(store.data, el.dataset.id, pin),
    );
    if (!result.ok) return;
    audit('staff', `Changed the PIN for ${result.member.name}`);
    save();
    closeModal();
    render();
    toast(`New PIN saved for ${result.member.name}`);
  },
  removeStaff(el) {
    const member = findStaff(store.data, el.dataset.id);
    if (!member) return;
    const last = store.data.staff.length === 1;
    confirmDialog({
      message: last
        ? `Remove ${member.name}? Nobody will be left on the staff list, so sign-in will be turned off.`
        : `Remove ${member.name} from the staff list? Their name stays on past orders.`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        const result = await apply(
          () => staffApi.remove(member.id),
          () => removeStaff(store.data, member.id),
        );
        if (!result.ok) return;
        audit('staff', `Removed ${member.name} from staff`);
        if (store.ui.staffId === member.id) store.ui.staffId = null;
        save();
        render();
        toast(`Removed ${member.name}`);
      },
    });
  },
};

export const change = {
  async setStaffRole(el) {
    const result = await apply(
      () => staffApi.setRole(el.dataset.id, el.value),
      () => setStaffRole(store.data, el.dataset.id, el.value),
    );
    if (!result.ok) return render();
    audit('staff', `Made ${result.member.name} ${ROLE_LABEL[result.member.role].toLowerCase()}`);
    save();
    render();
  },
};

export const submit = {
  async addStaff(form) {
    const first = store.data.staff.length === 0;
    const member = {
      name: form.elements.sname.value,
      pin: form.elements.spin.value,
      role: form.elements.srole.value,
    };
    const result = await apply(
      () => staffApi.add(member),
      () => addStaff(store.data, member),
    );
    if (!result.ok) return;
    // Whoever sets up sign-in is the first manager: sign them in rather than locking them out.
    if (first) store.ui.staffId = result.member.id;
    audit('staff', `Added ${result.member.name} as ${ROLE_LABEL[result.member.role].toLowerCase()}`);
    save();
    render();
    toast(
      first
        ? `Staff sign-in is on. You are signed in as ${result.member.name}.`
        : `Added ${result.member.name}`,
    );
  },
  /** Lost manager PIN, with a server: the owner password turns staff sign-in off. */
  async resetStaff(form) {
    const result = await staffApi.reset(form.elements.password.value);
    if (!result.ok) {
      $('#connect-error').textContent = result.error;
      return;
    }
    store.ui.staffId = null;
    closeModal();
    render();
    toast('Staff sign-in is off. Add staff again in Settings.');
  },
};
