import { completesOrder, ticketUrgency } from '../domain/kitchen.js';
import { store } from '../state/store.js';
import { timeAgo, timeStr } from '../utils/date.js';
import { esc } from '../utils/text.js';

function ticketCard(t, now) {
  const finishes = completesOrder(store.data, t);
  const lines = t.lines
    .map(
      (l) =>
        `<li><b>${l.qty}×</b> ${esc(l.name)}${l.note ? `<div class="note">${esc(l.note)}</div>` : ''}</li>`,
    )
    .join('');
  const button = t.done
    ? `<button data-act="recallTicket" data-id="${t.id}">Recall</button>`
    : `<button class="btn-ok" data-act="markTicketReady" data-id="${t.id}">${finishes ? 'Ready · complete order' : 'Mark ready'}</button>`;
  return `<article class="kcard ${ticketUrgency(t, now)}">
    <header><b>${esc(t.label)}</b><span class="muted">#${t.no}</span></header>
    <div class="muted small">${timeStr(t.createdAt)} · ${timeAgo(t.createdAt, now)}</div>
    <ul>${lines}</ul>
    ${button}
  </article>`;
}

export function renderKitchenView() {
  const { data, ui } = store;
  const now = Date.now();
  const active = data.tickets.filter((t) => !t.done).sort((a, b) => a.createdAt - b.createdAt);
  const ready = data.tickets.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const list = ui.showReadyTickets ? ready : active;
  const empty = ui.showReadyTickets
    ? 'Nothing marked ready in the last 24 hours.'
    : 'No tickets waiting. Orders appear here when you tap “Send to kitchen”. Marking the last ticket of an order ready completes the order.';

  return `<div class="khead">
      <h1>Kitchen${ui.showReadyTickets ? ' · ready' : ''}</h1>
      <button data-act="toggleReadyTickets">${ui.showReadyTickets ? `Show active (${active.length})` : `Show ready (${ready.length})`}</button>
    </div>
    ${list.length ? `<div class="kgrid">${list.map((t) => ticketCard(t, now)).join('')}</div>` : `<div class="panel empty">${empty}</div>`}`;
}
