import { openMoveDialog } from '../components/moveDialog.js';
import { appendNotePreset, openNoteDialog, saveNote } from '../components/noteDialog.js';
import { returnReward } from '../domain/customers.js';
import { cancelPending, completeIfDone, sendToKitchen } from '../domain/kitchen.js';
import * as Orders from '../domain/orders.js';
import { isSoldOut, returnStock, returnUnsent, takeStock } from '../domain/stock.js';
import { findTable } from '../domain/tables.js';
import { currentOrder, save, staffName, store } from '../state/store.js';
import { audit, withManager } from '../ui/access.js';
import { money } from '../ui/format.js';
import { closeModal, confirmDialog } from '../ui/modal.js';
import { printReceiptNow, showReceipt } from '../ui/receipt.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';
import { renderItemsGrid } from '../views/ordersView.js';

function selectTable(tableId) {
  const { ui } = store;
  const open = Orders.openOrders(store.data).find((o) => o.table === tableId);
  ui.currentOrderId = open ? open.id : null;
  ui.pendingTable = open ? null : tableId;
  render();
}

/** On narrow screens the ticket sits below the menu, so bring it into view. */
function revealTicket() {
  if (window.matchMedia('(max-width: 720px)').matches) {
    $('.ticket-panel')?.scrollIntoView({ behavior: 'smooth' });
  }
}

function addMenuItem(itemId) {
  const item = store.data.items.find((i) => i.id === itemId);
  if (!item) return;
  if (isSoldOut(item)) {
    toast(`${item.name} is sold out`);
    return;
  }
  let order = currentOrder();
  if (!order) {
    const pending = store.ui.pendingTable;
    if (pending == null) {
      toast('Pick a table or start a takeaway first');
      return;
    }
    const table = pending === 'take' ? null : findTable(store.data, pending);
    if (pending !== 'take' && !table) {
      store.ui.pendingTable = null;
      render();
      toast('That table was removed. Pick another one.');
      return;
    }
    order = Orders.createOrder(store.data, table, Date.now(), staffName());
    store.ui.currentOrderId = order.id;
    store.ui.pendingTable = null;
  }
  takeStock(item);
  Orders.addItem(order, item);
  save();
  render();
}

function changeLineQty(lineId, delta) {
  const order = currentOrder();
  const line = order?.lines.find((l) => l.id === lineId);
  if (!line) return;
  const item = store.data.items.find((i) => i.id === line.itemId);
  if (delta > 0 && (line.reward || !takeStock(item))) {
    toast(line.reward ? 'One reward per order' : `${line.name} is sold out`);
    return;
  }
  const qty = line.qty + delta;
  const apply = (approver = null) => {
    const removedSent = Math.max(0, line.sent - Math.max(qty, 0));
    // Stock comes back only for a portion the kitchen never received.
    if (delta < 0 && !removedSent) returnStock(item, 1);
    Orders.setLineQty(order, lineId, qty);
    if (line.reward && qty <= 0) returnReward(store.data, order);
    if (removedSent) {
      cancelPending(order, lineId, removedSent); // take it off the kitchen screen
      audit(
        'remove',
        `Removed ${removedSent}× ${line.name} already sent to the kitchen · ${Orders.orderLabel(order)} #${order.no}`,
        approver,
      );
    }
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
      onConfirm: () => withManager('remove a dish already sent to the kitchen', apply),
    });
  } else {
    apply();
  }
}

export const click = {
  selectTable: (el) => selectTable(el.dataset.id),
  newTakeaway() {
    store.ui.currentOrderId = null;
    store.ui.pendingTable = 'take';
    render();
    revealTicket();
    toast('New takeaway: tap menu items to add them');
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
    const target = el.dataset.id === 'take' ? null : findTable(store.data, el.dataset.id);
    if (el.dataset.id !== 'take' && !target) return;
    Orders.moveOrder(order, target);
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
      onConfirm: () =>
        withManager('void an order', (approver) => {
          returnUnsent(store.data, order);
          if (order.lines.some((l) => l.reward)) returnReward(store.data, order);
          Orders.voidOrder(order);
          audit(
            'void',
            `Voided ${Orders.orderLabel(order)} #${order.no} (${money(Orders.calcTotals(order).total)})`,
            approver,
          );
          store.ui.currentOrderId = null;
          save();
          render();
          toast('Order voided');
        }),
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
