/**
 * Activity log: a short record of the actions an owner wants to be able to check later (voids,
 * walk-outs, removed dishes, staff changes). Newest entries are kept, oldest dropped.
 */
import { LOG_LIMIT } from '../config.js';

export function logEvent(data, type, text, staff = null, now = Date.now()) {
  data.log = [...(data.log || []), { at: now, type, text, staff }].slice(-LOG_LIMIT);
}

/** Newest first. */
export const recentLog = (data, limit = 50) => [...(data.log || [])].reverse().slice(0, limit);
