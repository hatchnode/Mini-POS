import { openMoveDialog } from '../components/moveDialog.js';
import { appendNotePreset, openNoteDialog, saveNote } from '../components/noteDialog.js';
import { cancelPending, completeIfDone, sendToKitchen } from '../domain/kitchen.js';
import * as Orders from '../domain/orders.js';
import { currentOrder, save, store } from '../state/store.js';
import { closeModal, confirmDialog } from '../ui/modal.js';
import { printReceiptNow, showReceipt } from '../ui/receipt.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';
import { renderItemsGrid } from '../views/ordersView.js';

function selectTable(n) {
  const { ui } = store;
  const open = Orders.openOrders(store.data).find((o) => o.table === n);
  ui.currentOrderId = open ? open.id : null;
  ui.pendingTable = open ? null : n;
  render();
}

function addMenuItem(itemId) {
  const item = store.data.items.find((i) => i.id === itemId);
  if (!item) return;
  let order = currentOrder();
  if (!order) {
    if (store.ui.pendingTable == null) {
      toast('Pick a table or start a takeaway first');
      return;
    }
    order = Orders.createOrder(store.data, store.ui.pendingTable);
    store.ui.currentOrderId = order.id;
    store.ui.pendingTable = null;
  }
  Orders.addItem(order, item);
  save();
  render();
}

function changeLineQty(lineId, delta) {
  const order = currentOrder();
  const line = order?.lines.find((l) => l.id === lineId);
  if (!line) return;
  const qty = line.qty + delta;
  const apply = () => {
    const removedSent = Math.max(0, line.sent - Math.max(qty, 0));
    Orders.setLineQty(order, lineId, qty);
    if (removedSent) cancelPending(order, lineId, removedSent); // take it off the kitchen screen
    if (Orders.discardIfEmpty(store.data, order)) {
      store.ui.currentOrderId = null;
      store.ui.pendingTable = order.table ?? 'take';
    } else if (completeIfDone(order)) {
      // Removing the last cooking dish can leave nothing for the kitchen to do.
      store.ui.currentOrderId = null;
      toast(`${Orders.orderLabel(order)} #${order.no} completed`);
    }
    save();
    render();
  };
  if (delta < 0 && qty < line.sent) {
    confirmDialog({
      message: `"${line.name}" was already sent to the kitchen. Remove it anyway? If it is still cooking it will be taken off the kitchen screen.`,
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: apply,
    });
  } else {
    apply();
  }
}

export const click = {
  selectTable: (el) => selectTable(Number(el.dataset.n)),
  newTakeaway() {
    store.ui.currentOrderId = null;
    store.ui.pendingTable = 'take';
    render();
  },
  openOrder(el) {
    store.ui.currentOrderId = el.dataset.id;
    store.ui.pendingTable = null;
    render();
  },
  selectCategory(el) {
    store.ui.category = el.dataset.id;
    render();
  },
  addItem: (el) => addMenuItem(el.dataset.id),
  increaseLine: (el) => changeLineQty(el.dataset.id, 1),
  decreaseLine: (el) => changeLineQty(el.dataset.id, -1),
  editNote: (el) => openNoteDialog(el.dataset.id),
  appendNotePreset: (el) => appendNotePreset(el.dataset.v),
  saveNote: (el) => saveNote(el.dataset.id),

  sendToKitchen() {
    const order = currentOrder();
    if (!order) return;
    const sent = sendToKitchen(order);
    if (!sent.length) {
      toast('Nothing new to send');
      return;
    }
    save();
    render();
    toast(`Sent ${sent.length} dish${sent.length === 1 ? '' : 'es'} to the kitchen`);
  },
  printBill() {
    const order = currentOrder();
    if (order) showReceipt(order);
  },
  moveOrder: () => openMoveDialog(),
  moveOrderTo(el) {
    const order = currentOrder();
    if (!order) return;
    Orders.moveOrder(order, el.dataset.n === 'take' ? 'take' : Number(el.dataset.n));
    save();
    closeModal();
    render();
    toast(`Moved to ${Orders.orderLabel(order)}`);
  },
  voidOrder() {
    const order = currentOrder();
    if (!order) return;
    confirmDialog({
      message: `Void ${Orders.orderLabel(order)} · order #${order.no}? This can't be undone.`,
      confirmLabel: 'Void order',
      danger: true,
      onConfirm: () => {
        Orders.voidOrder(order);
        store.ui.currentOrderId = null;
        save();
        render();
        toast('Order voided');
      },
    });
  },

  /** "Receipt" buttons (Sales) open the on-screen receipt; its Print button prints it. */
  printReceipt(el) {
    const order = store.data.orders.find((o) => o.id === el.dataset.id);
    if (order) showReceipt(order);
  },
  printReceiptNow(el) {
    const order = store.data.orders.find((o) => o.id === el.dataset.id);
    if (order) printReceiptNow(order);
  },
  scrollToTicket: () => $('.ticket-panel')?.scrollIntoView({ behavior: 'smooth' }),
};

export const input = {
  searchMenu(el) {
    store.ui.search = el.value;
    $('#item-grid').innerHTML = renderItemsGrid(); // keep focus in the search box
  },
};
