import { openMoveDialog } from '../components/moveDialog.js';
import { appendNotePreset, openNoteDialog, saveNote } from '../components/noteDialog.js';
import { createTicket } from '../domain/kitchen.js';
import * as Orders from '../domain/orders.js';
import { currentOrder, save, store } from '../state/store.js';
import { closeModal, confirmDialog } from '../ui/modal.js';
import { printReceipt } from '../ui/receipt.js';
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
    Orders.setLineQty(order, lineId, qty);
    if (Orders.discardIfEmpty(store.data, order)) {
      store.ui.currentOrderId = null;
      store.ui.pendingTable = order.table ?? 'take';
    }
    save();
    render();
  };
  if (delta < 0 && qty < line.sent) {
    confirmDialog({
      message: `"${line.name}" was already sent to the kitchen. Remove it anyway?`,
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
    if (!createTicket(store.data, order)) {
      toast('Nothing new to send');
      return;
    }
    save();
    render();
    toast('Sent to kitchen');
  },
  printBill() {
    const order = currentOrder();
    if (order) printReceipt(order);
  },
  moveOrder: () => openMoveDialog(),
  moveOrderTo(el) {
    const order = currentOrder();
    if (!order) return;
    Orders.moveOrder(store.data, order, el.dataset.n === 'take' ? 'take' : Number(el.dataset.n));
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
        Orders.voidOrder(store.data, order);
        store.ui.currentOrderId = null;
        save();
        render();
        toast('Order voided');
      },
    });
  },

  printReceipt(el) {
    const order = store.data.orders.find((o) => o.id === el.dataset.id);
    if (order) printReceipt(order);
  },
  scrollToTicket: () => $('.ticket-panel')?.scrollIntoView({ behavior: 'smooth' }),
};

export const input = {
  searchMenu(el) {
    store.ui.search = el.value;
    $('#item-grid').innerHTML = renderItemsGrid(); // keep focus in the search box
  },
};
