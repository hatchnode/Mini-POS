import { createSeedData, migrate } from './schema.js';
import { isStorageAvailable, readStoredData, writeStoredData } from './storage.js';
import { findStaff } from '../domain/staff.js';
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
    /** Table id, 'take' for a new takeaway, or null. The order is created on the first item. */
    pendingTable: null,
    category: 'all',
    search: '',
    salesDate: todayStr(),
    showReadyDishes: false,
    /** Orders screen: tables are being added, renamed or removed. */
    editTables: false,
    /** Who is signed in (when staff are set up). Asked again after the page reloads. */
    staffId: null,
    /** Sales screen: 'day', 'trends' or 'customers'; trends cover 7 or 30 days. */
    salesTab: 'day',
    trendDays: 7,
  },
};

let saveErrorHandler = () => {};
export const onSaveError = (fn) => {
  saveErrorHandler = fn;
};

/** Called after every save, e.g. to copy the data to the data folder. */
const afterSave = [];
export const onSave = (fn) => {
  afterSave.push(fn);
};

export function save() {
  if (store.storageOK && !writeStoredData(store.data)) {
    store.storageOK = false;
    saveErrorHandler();
  }
  afterSave.forEach((fn) => fn());
}

/** With a server, the staff list belongs to the server: restoring a backup must not replace it. */
let serverOwnsStaff = false;
export const setServerOwnsStaff = (value) => {
  serverOwnsStaff = value;
};

export function replaceData(raw) {
  const staff = store.data.staff;
  store.data = migrate(raw);
  if (serverOwnsStaff) store.data.staff = staff;
  clearSelection();
  store.ui.category = 'all';
}

export function clearSelection() {
  store.ui.currentOrderId = null;
  store.ui.pendingTable = null;
}

export const currentOrder = () =>
  store.data.orders.find((o) => o.id === store.ui.currentOrderId && o.status === 'open') || null;

/** The signed-in staff member, or null when nobody is signed in (or staff aren't set up). */
export const currentStaff = () => findStaff(store.data, store.ui.staffId);
export const staffName = () => currentStaff()?.name ?? null;
