import { summarizeTrends } from '../domain/insights.js';
import { lowStockItems } from '../domain/stock.js';
import { store } from '../state/store.js';
import { money } from '../ui/format.js';
import { dayLabel, hourLabel } from '../utils/date.js';
import { esc } from '../utils/text.js';
import { hourlyChart, kpi, splitTable, topItemsTable } from './salesWidgets.js';

function dailyChart(byDay) {
  const max = Math.max(...byDay.map((d) => d.total));
  if (!max) return '<div class="empty">No paid bills in this period yet.</div>';
  // A month of bars is too tight for a label under each one, so label every few days.
  const every = Math.ceil(byDay.length / 10);
  const bars = byDay
    .map((d, i) => {
      const fill = d.total
        ? `<div class="bar-f" style="height:${Math.max(2, (d.total / max) * 100)}%"></div>`
        : '';
      const label = (byDay.length - 1 - i) % every === 0 ? dayLabel(d.date) : '';
      return `<div class="bar" title="${dayLabel(d.date)}: ${money(d.total)} · ${d.bills} bills"><div class="bar-w">${fill}</div><span>${label}</span></div>`;
    })
    .join('');
  return `<div class="bars">${bars}</div>`;
}

/** "▲ 12% vs the 7 days before", or nothing when there is no earlier period to compare. */
function changeNote(t) {
  if (t.change == null) return '<span class="muted small">no earlier period to compare</span>';
  const pct = Math.round(Math.abs(t.change) * 100);
  const cls = t.change >= 0 ? 'good' : 'bad';
  return `<span class="small ${cls}">${t.change >= 0 ? '▲' : '▼'} ${pct}% vs the ${t.days} days before (${money(t.previousTotal)})</span>`;
}

const nameList = (items, render) =>
  items.length ? `<div class="pills">${items.map(render).join(' ')}</div>` : '';

export function renderTrendsTab() {
  const { data, ui } = store;
  const t = summarizeTrends(data, ui.trendDays);
  const s = t.current;
  const low = lowStockItems(data, Number(data.settings.lowStock) || 0);
  const periods = [7, 30]
    .map(
      (n) =>
        `<button class="chip ${ui.trendDays === n ? 'on' : ''}" data-act="trendDays" data-days="${n}">Last ${n} days</button>`,
    )
    .join('');

  return `<div class="page-top"><div class="cats">${periods}</div>${changeNote(t)}</div>
    <div class="kpis">
      ${kpi('Paid sales', money(s.total))}
      ${kpi('Bills paid', s.paidCount)}
      ${kpi('Average bill', money(s.average))}
      ${kpi('Per day', money(Math.round(s.total / t.days)))}
      ${kpi('Best day', t.bestDay ? `${dayLabel(t.bestDay.date)} <span class="muted small">${money(t.bestDay.total)}</span>` : '—')}
      ${kpi('Busiest hour', t.busiestHour == null ? '—' : `${hourLabel(t.busiestHour)}–${hourLabel((t.busiestHour + 1) % 24)}`)}
      ${kpi('Walk-outs', `${s.walkoutCount} · ${money(s.walkoutTotal)}`, s.walkoutCount ? 'warn' : '')}
    </div>
    <div class="split">
      <section class="panel"><div class="panel-h"><h2>Paid sales by day</h2></div><div class="panel-b">${dailyChart(t.byDay)}</div></section>
      <section class="panel"><div class="panel-h"><h2>Best sellers</h2></div>
        <div class="tablewrap">${topItemsTable(s.topItems)}</div></section>
    </div>
    <div class="split">
      <section class="panel"><div class="panel-h"><h2>Busiest hours (all days together)</h2></div><div class="panel-b">${hourlyChart(s.byHour)}</div></section>
      <section class="panel"><div class="panel-h"><h2>How it was paid</h2></div>
        <div class="tablewrap">${splitTable(s.byMethod, s.total, 'Method')}</div></section>
    </div>
    <div class="split even">
      <section class="panel"><div class="panel-h"><h2>Not selling</h2><span class="muted small">on the menu, none sold in ${t.days} days</span></div>
        <div class="panel-b">${
          s.paidCount
            ? nameList(t.notSelling, (i) => `<span class="pill void">${esc(i.name)}</span>`) ||
              '<span class="muted">Everything on the menu sold at least once.</span>'
            : '<span class="muted">No paid bills in this period yet.</span>'
        }</div></section>
      <section class="panel"><div class="panel-h"><h2>Running low</h2><span class="muted small">items you count in Menu</span></div>
        <div class="panel-b">${
          nameList(
            low,
            (i) =>
              `<span class="pill ${i.stock <= 0 ? 'walkout' : 'low'}">${esc(i.name)} · ${i.stock <= 0 ? 'sold out' : `${i.stock} left`}</span>`,
          ) || '<span class="muted">Nothing is running low.</span>'
        }</div></section>
    </div>`;
}
