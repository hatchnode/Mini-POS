import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../config.js';
import { uid } from '../utils/id.js';

const SAMPLE_CATEGORIES = [
  { id: 'c1', name: 'Mains' },
  { id: 'c2', name: 'Starters' },
  { id: 'c3', name: 'Drinks' },
  { id: 'c4', name: 'Desserts' },
];

const SAMPLE_ITEMS = [
  ['Classic Burger', 1250, 'c1'],
  ['Chicken Sandwich', 1150, 'c1'],
  ['Veggie Bowl', 1100, 'c1'],
  ['Fish & Chips', 1450, 'c1'],
  ['Pasta of the Day', 1300, 'c1'],
  ['Fries', 450, 'c2'],
  ['Soup of the Day', 600, 'c2'],
  ['Garden Salad', 750, 'c2'],
  ['Wings (6)', 900, 'c2'],
  ['Coffee', 300, 'c3'],
  ['Tea', 275, 'c3'],
  ['Soda', 250, 'c3'],
  ['Fresh Lemonade', 400, 'c3'],
  ['Beer', 650, 'c3'],
  ['House Wine', 800, 'c3'],
  ['Cheesecake', 650, 'c4'],
  ['Brownie Sundae', 700, 'c4'],
  ['Ice Cream', 450, 'c4'],
];

/** Fresh data with a sample menu. */
export function createSeedData() {
  return {
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    categories: SAMPLE_CATEGORIES.map((c) => ({ ...c })),
    items: SAMPLE_ITEMS.map(([name, price, catId]) => ({ id: uid(), name, price, catId, active: true })),
    orders: [],
    tickets: [],
    seq: 1,
  };
}

/** Bring stored or imported data up to the current schema. */
export function migrate(raw) {
  const data = { ...raw };
  const settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  delete settings.taxRate; // v2: tax removed
  data.settings = settings;
  data.categories = Array.isArray(raw.categories) ? raw.categories : [];
  data.items = Array.isArray(raw.items) ? raw.items : [];
  data.orders = Array.isArray(raw.orders) ? raw.orders : [];
  data.tickets = Array.isArray(raw.tickets) ? raw.tickets : [];
  data.seq = Number(raw.seq) || 1;
  data.version = SCHEMA_VERSION;
  return data;
}

/** True when an object looks like a Mini-POS backup. */
export const isBackup = (raw) => !!raw && Array.isArray(raw.items) && Array.isArray(raw.categories);
