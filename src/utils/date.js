/** Local calendar date as YYYY-MM-DD. */
export function todayStr(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** [start, end) timestamps for a local YYYY-MM-DD date. */
export function dayRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.getTime(), end.getTime()];
}

/** The date `days` after (or before, if negative) a local YYYY-MM-DD date. */
export function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

/** "Mon 9" style label for a YYYY-MM-DD date. */
export const dayLabel = (dateStr) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' });

export const timeStr = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const dateTimeStr = (ts) =>
  new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function timeAgo(ts, now = Date.now()) {
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/** Time only when `ts` falls on the same day as `ref`, otherwise a short date and time. */
export const timeOnDay = (ts, ref) =>
  sameDay(ts, ref)
    ? timeStr(ts)
    : new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Human duration: "<1 min", "12 min", "1h 05m". */
export function durationStr(ms) {
  if (ms == null || ms < 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
