/** App-wide constants. Change these to tune behaviour without touching logic. */

export const STORAGE_KEY = 'mini-pos-v1';
export const SCHEMA_VERSION = 2;

export const MAX_TABLES = 60;
export const PAYMENT_METHODS = ['cash', 'card', 'other'];
export const TIP_PRESETS = [10, 15, 20];

/** Kitchen tickets turn amber / red after this many minutes. */
export const TICKET_WARN_MINUTES = 8;
export const TICKET_LATE_MINUTES = 15;
/** Completed kitchen tickets are kept this long, then pruned on load. */
export const DONE_TICKET_TTL_MS = 24 * 60 * 60 * 1000;

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
  address: '',
  currency: '$',
  tables: 12,
  footer: 'Thank you! Come again.',
};
