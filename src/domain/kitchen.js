import { DONE_TICKET_TTL_MS, TICKET_LATE_MINUTES, TICKET_WARN_MINUTES } from '../config.js';
import { uid } from '../utils/id.js';
import { orderLabel } from './orders.js';

/**
 * Create a kitchen ticket for everything not yet sent, then mark it sent.
 * Returns the ticket, or null when there is nothing new.
 */
export function createTicket(data, order, now = Date.now()) {
  const lines = order.lines
    .filter((l) => l.qty > l.sent)
    .map((l) => ({ name: l.name, qty: l.qty - l.sent, note: l.note }));
  if (!lines.length) return null;
  const ticket = {
    id: uid(),
    orderId: order.id,
    no: order.no,
    label: orderLabel(order),
    lines,
    createdAt: now,
    done: false,
  };
  data.tickets.push(ticket);
  order.lines.forEach((l) => {
    l.sent = l.qty;
  });
  return ticket;
}

export function setTicketDone(ticket, done, now = Date.now()) {
  ticket.done = done;
  ticket.doneAt = done ? now : null;
}

export function pruneTickets(data, now = Date.now()) {
  data.tickets = data.tickets.filter((t) => !t.done || now - (t.doneAt || t.createdAt) < DONE_TICKET_TTL_MS);
}

/** '', 'mid', 'late' or 'done' for colouring a ticket by age. */
export function ticketUrgency(ticket, now = Date.now()) {
  if (ticket.done) return 'done';
  const mins = (now - ticket.createdAt) / 60000;
  if (mins > TICKET_LATE_MINUTES) return 'late';
  if (mins > TICKET_WARN_MINUTES) return 'mid';
  return '';
}
