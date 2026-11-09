import { markTicketReady, recallTicket } from '../domain/kitchen.js';
import { orderLabel } from '../domain/orders.js';
import { save, store } from '../state/store.js';
import { money } from '../ui/format.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

const findTicket = (id) => store.data.tickets.find((t) => t.id === id);

export const click = {
  markTicketReady(el) {
    const ticket = findTicket(el.dataset.id);
    if (!ticket) return;
    const completed = markTicketReady(store.data, ticket);
    if (completed && store.ui.currentOrderId === completed.id) store.ui.currentOrderId = null;
    save();
    render();
    toast(
      completed
        ? `${orderLabel(completed)} #${completed.no} completed · ${money(completed.totals.total)}`
        : 'Marked ready',
    );
  },
  recallTicket(el) {
    const ticket = findTicket(el.dataset.id);
    if (!ticket) return;
    const reopened = recallTicket(store.data, ticket);
    save();
    render();
    toast(reopened ? `${orderLabel(reopened)} #${reopened.no} reopened` : 'Ticket recalled');
  },
  toggleReadyTickets() {
    store.ui.showReadyTickets = !store.ui.showReadyTickets;
    render();
  },
};
