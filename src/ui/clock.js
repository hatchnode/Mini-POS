import { store } from '../state/store.js';
import { $ } from '../utils/dom.js';
import { isModalOpen } from './modal.js';
import { render } from './render.js';

function tick() {
  $('#clock').textContent = new Date().toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  // Keep kitchen ticket ages fresh.
  if (store.ui.view === 'kitchen' && !isModalOpen()) render();
}

export function startClock(intervalMs = 30000) {
  tick();
  return setInterval(tick, intervalMs);
}
