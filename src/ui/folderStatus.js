import { folder, folderSupported } from '../state/folder.js';
import { $ } from '../utils/dom.js';
import { timeStr } from '../utils/date.js';
import { esc } from '../utils/text.js';

/** One line describing the data folder, for Settings. */
export function folderStatusHtml() {
  if (!folderSupported()) {
    return 'Not available in this browser. Saving to a folder needs Chrome or Edge on a computer.';
  }
  const name = `<b>${esc(folder.name)}</b>`;
  if (folder.status === 'on') {
    return `Saving to the folder ${name}${folder.savedAt ? ` · last saved ${timeStr(folder.savedAt)}` : ''}`;
  }
  if (folder.status === 'paused')
    return `<b class="bad">Paused.</b> The browser needs your OK to keep saving to ${name}.`;
  if (folder.status === 'error') return `<b class="bad">Could not save to ${name}:</b> ${esc(folder.error)}`;
  return 'No folder chosen. Data is kept only in this browser.';
}

/** Banner on every screen while saving to the folder is paused or failing, plus the Settings line. */
export function renderFolderStatus() {
  const banner = $('#folder-banner');
  const stuck = folder.status === 'paused' || folder.status === 'error';
  banner.hidden = !stuck;
  banner.innerHTML = stuck
    ? `${folder.status === 'paused' ? `Saving to your data folder “${esc(folder.name)}” is paused.` : `Could not save to your data folder: ${esc(folder.error)}.`}
       <button class="small" data-act="resumeFolder">${folder.status === 'paused' ? 'Resume saving' : 'Try again'}</button>`
    : '';
  const line = $('#folder-status');
  if (line) line.innerHTML = folderStatusHtml();
}
