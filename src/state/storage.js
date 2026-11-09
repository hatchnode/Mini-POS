import { STORAGE_KEY } from '../config.js';

/** localStorage can be missing or blocked (private mode, some embedded previews). */
export function isStorageAvailable() {
  try {
    localStorage.setItem('__mini_pos_test', '1');
    localStorage.removeItem('__mini_pos_test');
    return true;
  } catch {
    return false;
  }
}

export function readStoredData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns false when the write failed (quota exceeded or blocked). */
export function writeStoredData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
