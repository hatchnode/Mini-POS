import { createSeedData, migrate } from './schema.js';
import { isStorageAvailable, readStoredData, writeStoredData } from './storage.js';
import { todayStr } from '../utils/date.js';

function loadInitialData(storageOK) {
  const raw = storageOK ? readStoredData() : null;
  return raw ? migrate(raw) : createSeedData();
}

const storageOK = isStorageAvailable();

/**
 * Single source of truth.
 * - `data` is persisted (menu, orders with their dishes, settings).
 * - `ui` is screen state and is never saved.
 */
export const store = {
  storageOK,
  data: loadInitialData(storageOK),
  ui: {
    view: 'orders',
    currentOrderId: null,
    /** Table number, 'take' for a new takeaway, or null. The order is created on the first item. */
    pendingTable: null,
    category: 'all',
    search: '',
    salesDate: todayStr(),
    showReadyDishes: false,
  },
};

let saveErrorHandler = () => {};
export const onSaveError = (fn) => {
  saveErrorHandler = fn;
};

export function save() {
  if (!store.storageOK) return;
  if (!writeStoredData(store.data)) {
    store.storageOK = false;
    saveErrorHandler();
  }
}

export function replaceData(raw) {
  store.data = migrate(raw);
  clearSelection();
  store.ui.category = 'all';
}

export function clearSelection() {
  store.ui.currentOrderId = null;
  store.ui.pendingTable = null;
}

export const currentOrder = () =>
  store.data.orders.find((o) => o.id === store.ui.currentOrderId && o.status === 'open') || null;
