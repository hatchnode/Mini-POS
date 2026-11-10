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
import { clearSelection, save, store } from '../state/store.js';
import { audit } from '../ui/access.js';
import { closeModal, confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';

export const click = {
  /** Lock screen: pick a name, then enter that person's PIN. */
  signIn(el) {
    const member = findStaff(store.data, el.dataset.id);
    if (!member) return;
    openPinDialog({
      title: `Hi ${member.name}`,
      hint: 'Enter your PIN.',
      check: (pin) => checkPin(member, pin) && member,
      onOk: () => {
        store.ui.staffId = member.id;
        render();
        toast(`Signed in as ${member.name}`);
      },
    });
  },
  lockApp() {
    store.ui.staffId = null;
    store.ui.editTables = false;
    clearSelection();
    closeModal();
    render();
  },
  pinKey: (el) => pinKey(el.dataset.k),
  /** The way back in when the manager PIN is lost. It is recorded, so it can't be done quietly. */
  forgotPin() {
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
  saveStaffPin(el) {
    const result = setStaffPin(store.data, el.dataset.id, $('#staff-pin').value);
    if (!result.ok) return toast(result.error);
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
      onConfirm: () => {
        const result = removeStaff(store.data, member.id);
        if (!result.ok) return toast(result.error);
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
  setStaffRole(el) {
    const result = setStaffRole(store.data, el.dataset.id, el.value);
    if (!result.ok) {
      toast(result.error);
      return render();
    }
    audit('staff', `Made ${result.member.name} ${ROLE_LABEL[result.member.role].toLowerCase()}`);
    save();
    render();
  },
};

export const submit = {
  addStaff(form) {
    const first = store.data.staff.length === 0;
    const result = addStaff(store.data, {
      name: form.elements.sname.value,
      pin: form.elements.spin.value,
      role: form.elements.srole.value,
    });
    if (!result.ok) return toast(result.error);
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
};
