import { ALARM_REPEAT_MINUTES } from '../config.js';
import { unpaidAlarms } from '../domain/alarms.js';
import { balanceDue, orderLabel } from '../domain/orders.js';
import { store } from '../state/store.js';
import { $ } from '../utils/dom.js';
import { esc } from '../utils/text.js';
import { money } from './format.js';
import { playAlarm } from './sound.js';

const MAX_SHOWN = 3;
let lastIds = new Set();
let lastSoundAt = 0;

/** Orders alarming right now. */
export const currentAlarms = (now = Date.now()) =>
  unpaidAlarms(store.data, now, Number(store.data.settings.unpaidAlarmMinutes) || 0);

export const alarmingOrderIds = (now = Date.now()) => new Set(currentAlarms(now).map((a) => a.order.id));

/** The Orders screen fills the window; shrink it by the banner's height so nothing is cut off. */
const setBannerHeight = (px) => document.documentElement.style.setProperty('--alarm-h', `${px}px`);

const minsSince = (ts, now) => Math.max(0, Math.floor((now - ts) / 60000));

/** The red banner under the header, shown on every screen while any table is alarming. */
export function renderAlarmBanner(now = Date.now()) {
  const el = $('#alarm-banner');
  const alarms = currentAlarms(now);
  el.hidden = !alarms.length;
  if (!alarms.length) {
    el.innerHTML = '';
    setBannerHeight(0);
    return alarms;
  }
  const rows = alarms
    .slice(0, MAX_SHOWN)
    .map(
      ({ order, since }) => `<div class="alarm-row">
        <span><b>${esc(orderLabel(order))} #${order.no}</b> served ${minsSince(since, now)} min ago, unpaid <b>${money(balanceDue(order))}</b></span>
        <span class="alarm-acts">
          <button class="small" data-act="openAlarmOrder" data-id="${order.id}">Open</button>
          <button class="small" data-act="snoozeAlarm" data-id="${order.id}">Customer still here</button>
        </span>
      </div>`,
    )
    .join('');
  const more =
    alarms.length > MAX_SHOWN
      ? `<div class="alarm-more">+${alarms.length - MAX_SHOWN} more unpaid tables</div>`
      : '';
  el.innerHTML = `<div class="alarm-title">⚠ Take payment before they leave</div>${rows}${more}`;
  setBannerHeight(el.offsetHeight);
  return alarms;
}

/**
 * Called on every clock tick. Plays the sound when a table starts alarming, and again every few
 * minutes while any table is still alarming. Returns true when the set of alarming tables changed.
 */
export function checkAlarms(now = Date.now()) {
  const alarms = renderAlarmBanner(now);
  const ids = new Set(alarms.map((a) => a.order.id));
  const isNew = [...ids].some((id) => !lastIds.has(id));
  const changed = isNew || ids.size !== lastIds.size;
  const repeatDue = ids.size && now - lastSoundAt >= ALARM_REPEAT_MINUTES * 60000;
  if (store.data.settings.alarmSound && (isNew || repeatDue) && ids.size) {
    if (playAlarm()) lastSoundAt = now;
  }
  lastIds = ids;
  return changed;
}
