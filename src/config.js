/** App-wide constants. Change these to tune behaviour without touching logic. */

export const STORAGE_KEY = 'mini-pos-v1';
export const SCHEMA_VERSION = 7;

export const MAX_TABLES = 100;
/** Tables in a fresh install. */
export const DEFAULT_TABLE_COUNT = 12;

/** Dishes in the kitchen turn amber / red after this many minutes. */
export const DISH_WARN_MINUTES = 8;
export const DISH_LATE_MINUTES = 15;
/** How far back the kitchen's "ready" list reaches. */
export const READY_LIST_HOURS = 12;

/** Unpaid alarm: how long Snooze silences a table, and how often the sound repeats. */
export const ALARM_SNOOZE_MINUTES = 10;
export const ALARM_REPEAT_MINUTES = 3;
/** How often the app re-checks alarms and timers. */
export const TICK_MS = 15000;

/** Cash is always offered and is what the cash drawer counts. Other methods are set in Settings. */
export const CASH = 'Cash';

/** Staff PINs are this many digits. */
export const PIN_LENGTH = 4;
/** The activity log keeps this many of the newest entries. */
export const LOG_LIMIT = 500;

/** The "Popular" menu tab: best sellers over this many days. */
export const POPULAR_DAYS = 30;
export const POPULAR_LIMIT = 12;

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
  /** Alarm when a served table is still unpaid after this many minutes (0 = off). */
  unpaidAlarmMinutes: 5,
  alarmSound: true,
  /** Ways to pay besides cash, e.g. ['Bank transfer']. Empty (the default) means cash only. */
  otherPayments: [],
  /** Items with tracked stock at or below this show as "low". */
  lowStock: 5,
  /** Loyalty: a reward after this many paid visits (0 = off), and what the reward is. */
  loyaltyVisits: 10,
  loyaltyReward: 'Free drink',
};
