import { setTicketDone } from '../domain/kitchen.js';
import { save, store } from '../state/store.js';
import { render } from '../ui/render.js';

function setDone(id, done) {
  const ticket = store.data.tickets.find((t) => t.id === id);
  if (!ticket) return;
  setTicketDone(ticket, done);
  save();
  render();
}

export const click = {
  markTicketReady: (el) => setDone(el.dataset.id, true),
  recallTicket: (el) => setDone(el.dataset.id, false),
  toggleReadyTickets() {
    store.ui.showReadyTickets = !store.ui.showReadyTickets;
    render();
  },
};
