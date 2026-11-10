import { backupFiles } from '../domain/backup.js';
import { changeOwnerPassword, connectDevice, disconnectDevice, setupServer } from '../state/server.js';
import { closeButton, closeModal, confirmDialog, openModal } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';
import { todayStr } from '../utils/date.js';
import { downloadFile } from '../utils/file.js';
import { zipFiles } from '../utils/zip.js';

const showError = (message) => {
  const el = $('#connect-error');
  if (el) el.textContent = message;
};

/** After connecting: say what happened to the data that was on this device. */
function connected(result) {
  if (!result.ok) return showError(result.error);
  render();
  if (result.replaced) {
    // The server's data replaced this device's: hand the old data over as a backup, just in case.
    downloadFile(
      `mini-pos-this-device-${todayStr()}.zip`,
      zipFiles(backupFiles(result.replaced)),
      'application/zip',
    );
    toast(
      'Connected. This device now shows the server’s data; what it had before was downloaded as a backup.',
      6000,
    );
  } else if (result.droppedStaff) {
    toast('Connected. Add your staff again in Settings: the server keeps its own PINs.', 6000);
  } else toast('Connected to the server');
}

export const click = {
  disconnectDevice() {
    confirmDialog({
      message: 'Disconnect this device from the server? It will need the owner password to connect again.',
      confirmLabel: 'Disconnect',
      danger: true,
      onConfirm: async () => {
        await disconnectDevice();
        render();
      },
    });
  },
  changePassword() {
    openModal(`
      <div class="mh"><h3>Change the owner password</h3>${closeButton}</div>
      <form data-submit="changePassword">
        <div class="mb">
          <label class="fld">Current owner password<input name="current" type="password" autocomplete="current-password" required></label>
          <label class="fld">New owner password (at least 8 characters)<input name="next" type="password" minlength="8" autocomplete="new-password" required></label>
          <p class="muted small">Every other device will be disconnected and must connect again with the new password.</p>
          <div class="connect-error" id="connect-error" role="alert"></div>
        </div>
        <div class="mf"><button type="button" data-act="closeModal">Cancel</button><button class="btn-primary">Change password</button></div>
      </form>`);
  },
};

export const submit = {
  async setupServer(form) {
    const { password, again, device } = form.elements;
    if (password.value !== again.value) return showError('The two passwords are not the same');
    connected(await setupServer(password.value, device.value));
  },
  async connectDevice(form) {
    connected(await connectDevice(form.elements.password.value, form.elements.device.value));
  },
  async changePassword(form) {
    const result = await changeOwnerPassword(form.elements.current.value, form.elements.next.value);
    if (!result.ok) return showError(result.error);
    closeModal();
    render();
    toast('Owner password changed');
  },
};
