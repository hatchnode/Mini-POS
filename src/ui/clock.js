import { TICK_MS } from '../config.js';
import { store } from '../state/store.js';
import { $ } from '../utils/dom.js';
import { checkAlarms } from './alarm.js';
import { isModalOpen } from './modal.js';
import { render } from './render.js';

/** Don't redraw the page under someone who is typing or using a dialog. */
const busy = () => isModalOpen() || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);

function tick() {
  $('#clock').textContent = new Date().toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  const alarmsChanged = checkAlarms();
  if (busy()) return;
  // Kitchen timers age every tick; on Orders, redraw when a table starts or stops alarming.
  if (store.ui.view === 'kitchen' || (alarmsChanged && store.ui.view === 'orders')) render();
}

export function startClock(intervalMs = TICK_MS) {
  tick();
  return setInterval(tick, intervalMs);
}
