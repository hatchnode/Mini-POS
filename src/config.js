/** App-wide constants. Change these to tune behaviour without touching logic. */

export const STORAGE_KEY = 'mini-pos-v1';
export const SCHEMA_VERSION = 5;

export const MAX_TABLES = 100;
/** Tables in a fresh install. */
export const DEFAULT_TABLE_COUNT = 12;

/** Dishes in the kitchen turn amber / red after this many minutes. */
export const DISH_WARN_MINUTES = 8;
export const DISH_LATE_MINUTES = 15;
/** How far back the kitchen's "ready" list reaches. */
export const READY_LIST_HOURS = 12;

export const NOTE_PRESETS = [
  'No onions',
  'No ice',
  'Extra spicy',
  'Mild',
  'Sauce on side',
  'Gluten-free',
  'Allergy',
  'Well done',
];

export const CATEGORY_COLORS = [
  '#c2410c',
  '#0f766e',
  '#7c3aed',
  '#be185d',
  '#1d4ed8',
  '#a16207',
  '#15803d',
  '#9f1239',
];

export const DEFAULT_SETTINGS = {
  name: 'My Restaurant',
  /** Location shown on receipts. */
  address: '',
  phone: '',
  currency: '$',
  footer: 'Thank you! Come again.',
};
