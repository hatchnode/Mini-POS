/** Pieces shared by the Sales tabs: KPI tiles, the hourly chart and small tables. */
import { chartHours } from '../domain/sales.js';
import { money } from '../ui/format.js';
import { hourLabel } from '../utils/date.js';
import { esc } from '../utils/text.js';

export const kpi = (label, value, cls = '') =>
  `<div class="panel kpi ${cls}"><div class="l">${label}</div><div class="v">${value}</div></div>`;

export function hourlyChart(byHour) {
  const hours = chartHours(byHour);
  if (!hours.length) return '<div class="empty">No paid bills yet for this day.</div>';
  const max = Math.max(...Object.values(byHour));
  const bars = hours
    .map((h) => {
      const v = byHour[h] || 0;
      const fill =
        v && max ? `<div class="bar-f" style="height:${Math.max(2, (v / max) * 100)}%"></div>` : '';
      return `<div class="bar" title="${hourLabel(h)}: ${money(v)}"><div class="bar-w">${fill}</div><span>${hourLabel(h)}</span></div>`;
    })
    .join('');
  return `<div class="bars">${bars}</div>`;
}

/** Paid sales split by a group (payment method or staff member), with each one's share. */
export function splitTable(rows, total, heading) {
  if (!rows.length) return '<div class="empty">—</div>';
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.name)}</td><td class="n">${r.count}</td><td class="n">${money(r.amount)}</td><td class="n muted">${total ? Math.round((r.amount / total) * 100) : 0}%</td></tr>`,
    )
    .join('');
  return `<table class="t"><thead><tr><th>${heading}</th><th class="n">Payments</th><th class="n">Amount</th><th class="n">Share</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function topItemsTable(items) {
  if (!items.length) return '<div class="empty">—</div>';
  const rows = items
    .map(
      (i) =>
        `<tr><td>${esc(i.name)}</td><td class="n">${i.qty}</td><td class="n">${money(i.revenue)}</td></tr>`,
    )
    .join('');
  return `<table class="t"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Sales</th></tr></thead><tbody>${rows}</tbody></table>`;
}
