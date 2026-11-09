import { DONE_TICKET_TTL_MS, TICKET_LATE_MINUTES, TICKET_WARN_MINUTES } from '../config.js';
import { uid } from '../utils/id.js';
import { completeOrder, orderLabel, reopenOrder, unsentCount } from './orders.js';

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

const findOrder = (data, ticket) => data.orders.find((o) => o.id === ticket.orderId);

/** Open tickets for an order. */
export const pendingTickets = (data, orderId) => data.tickets.filter((t) => t.orderId === orderId && !t.done);

/**
 * True when marking this ticket ready will complete its order:
 * the order is open, this is its last open ticket, and nothing is waiting to be sent.
 */
export function completesOrder(data, ticket) {
  const order = findOrder(data, ticket);
  if (!order || order.status !== 'open' || ticket.done) return false;
  return pendingTickets(data, order.id).every((t) => t === ticket) && unsentCount(order) === 0;
}

/** Mark a ticket ready. Returns the order if this completed it, otherwise null. */
export function markTicketReady(data, ticket, now = Date.now()) {
  const willComplete = completesOrder(data, ticket);
  ticket.done = true;
  ticket.doneAt = now;
  if (!willComplete) return null;
  const order = findOrder(data, ticket);
  completeOrder(order, now);
  return order;
}

/** Send a ticket back to the kitchen. Returns the order if it was reopened, otherwise null. */
export function recallTicket(data, ticket) {
  ticket.done = false;
  ticket.doneAt = null;
  const order = findOrder(data, ticket);
  if (!order || order.status !== 'completed') return null;
  reopenOrder(order);
  return order;
}

/** Order ids that already have a pending ticket count as "in kitchen". */
export const isInKitchen = (data, orderId) => pendingTickets(data, orderId).length > 0;

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
