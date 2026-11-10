import { server } from '../state/server.js';
import { esc } from '../utils/text.js';

const deviceField = `<label class="fld">Name for this device
  <input name="device" maxlength="40" placeholder="e.g. Front tablet, Kitchen screen" required></label>`;

/** Shown instead of the app until this device is connected to the server with the owner password. */
export function renderConnectView() {
  if (server.phase === 'setup') {
    return `<div class="lock connect">
      <h1>Set up Mini-POS</h1>
      <p class="muted">Choose an owner password. You will need it to connect each tablet or screen, so keep it private and somewhere safe.</p>
      <form class="panel panel-b form" data-submit="setupServer">
        <label class="fld">Owner password (at least 8 characters)
          <input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
        <label class="fld">Type it again
          <input name="again" type="password" minlength="8" autocomplete="new-password" required></label>
        ${deviceField}
        <div class="connect-error" id="connect-error" role="alert"></div>
        <button class="btn-primary">Set up and start</button>
      </form>
    </div>`;
  }
  return `<div class="lock connect">
    <h1>Connect this device</h1>
    <p class="muted">Enter the owner password to use Mini-POS on this device. You only do this once per device.</p>
    <form class="panel panel-b form" data-submit="connectDevice">
      <label class="fld">Owner password
        <input name="password" type="password" autocomplete="current-password" required></label>
      ${deviceField.replace('required', `required value="${esc(server.device)}"`)}
      <div class="connect-error" id="connect-error" role="alert"></div>
      <button class="btn-primary">Connect</button>
    </form>
  </div>`;
}
