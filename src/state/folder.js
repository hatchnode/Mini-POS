/**
 * Data folder: a folder on the computer that the app keeps up to date with its data as CSV files
 * (the same files as a backup). The browser's own storage stays the working copy; the folder is a
 * copy outside the browser that survives clearing browser data and can be opened in a spreadsheet
 * or copied to a USB stick.
 *
 * This uses the browser's File System Access API, which Chrome and Edge on a computer have.
 * The browser remembers the folder but, after a restart, may want one click before it lets the
 * app write there again; until then saving to the folder is "paused".
 */
import { BACKUP_TABLES, fileName } from '../domain/backup.js';

const DB_NAME = 'mini-pos-folder';
const STORE = 'handles';
const KEY = 'data-folder';
const SAVE_DELAY_MS = 800;

/** status: 'off' (no folder), 'on' (saving), 'paused' (needs a click to allow), 'error'. */
export const folder = { status: 'off', name: '', savedAt: null, error: '' };

let handle = null;
let timer = null;
let queue = Promise.resolve();
let listener = () => {};
/** What each file last contained, so unchanged files aren't rewritten. */
const written = new Map();

export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** Called whenever the folder's status changes, so the screen can show it. */
export const onFolderChange = (fn) => {
  listener = fn;
};

function setStatus(status, error = '') {
  Object.assign(folder, { status, error, name: handle?.name || '' });
  listener();
}

/** The remembered folder lives in the browser's IndexedDB (the only place a folder can be kept). */
function withStore(mode, run) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => {
        open.result.close();
        resolve(request?.result);
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

const canWrite = async (h, ask) => {
  const options = { mode: 'readwrite' };
  if ((await h.queryPermission(options)) === 'granted') return true;
  return ask ? (await h.requestPermission(options)) === 'granted' : false;
};

/** On start-up: pick up the remembered folder, if any. */
export async function initFolder() {
  if (!folderSupported()) return;
  try {
    handle = (await withStore('readonly', (s) => s.get(KEY))) || null;
    if (handle) setStatus((await canWrite(handle, false)) ? 'on' : 'paused');
  } catch {
    handle = null;
  }
}

/** Ask the user to pick a folder. Returns it, or null if they cancelled. */
export async function pickFolder() {
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite', id: 'mini-pos-data' });
  } catch (error) {
    if (error.name === 'AbortError') return null;
    throw error;
  }
}

/** The backup files found in a folder: `[{ name, text }]` (empty if it has none). */
export async function readFolderFiles(dir = handle) {
  const files = [];
  for (const table of BACKUP_TABLES) {
    try {
      const file = await (await dir.getFileHandle(fileName(table))).getFile();
      files.push({ name: file.name, text: await file.text() });
    } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
    }
  }
  return files;
}

/** Start saving to this folder, and remember it for next time. */
export async function useFolder(dir) {
  handle = dir;
  written.clear();
  await withStore('readwrite', (s) => s.put(dir, KEY));
  setStatus('on');
}

export async function forgetFolder() {
  clearTimeout(timer);
  handle = null;
  written.clear();
  folder.savedAt = null;
  await withStore('readwrite', (s) => s.delete(KEY)).catch(() => {});
  setStatus('off');
}

/** After a browser restart: one click lets the app write to the folder again. Must be called from a click. */
export async function resumeFolder() {
  if (!handle) return false;
  const ok = await canWrite(handle, true).catch(() => false);
  setStatus(ok ? 'on' : 'paused');
  return ok;
}

async function writeFiles(files) {
  if (!handle || folder.status === 'paused') return;
  try {
    for (const file of files) {
      // about.csv carries the save time, so it always differs; compare the rest to skip rewrites.
      if (written.get(file.name) === file.text) continue;
      const writable = await (await handle.getFileHandle(file.name, { create: true })).createWritable();
      await writable.write(file.text);
      await writable.close();
      written.set(file.name, file.text);
    }
    folder.savedAt = Date.now();
    setStatus('on');
  } catch (error) {
    // Permission was withdrawn (browser restarted, or the user revoked it): ask again with a click.
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') setStatus('paused');
    else setStatus('error', error.message || String(error));
  }
}

/** Write to the folder now. `getFiles` returns the backup files for the current data. */
export function saveToFolderNow(getFiles) {
  clearTimeout(timer);
  queue = queue.then(() => writeFiles(getFiles()));
  return queue;
}

/** Write shortly after the latest change, so a burst of taps becomes one save. */
export function scheduleFolderSave(getFiles) {
  if (!handle || folder.status === 'off' || folder.status === 'paused') return;
  clearTimeout(timer);
  timer = setTimeout(() => saveToFolderNow(getFiles), SAVE_DELAY_MS);
}
