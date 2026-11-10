import { setDrawer } from '../domain/drawer.js';
import { completedDishes, dishCsvRows } from '../domain/sales.js';
import { save, store } from '../state/store.js';
import { audit, withManager } from '../ui/access.js';
import { printDayReportNow, showDayReport } from '../ui/dayReport.js';
import { money } from '../ui/format.js';
import { confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { dayRange, todayStr } from '../utils/date.js';
import { downloadText, toCsv } from '../utils/file.js';
import { parseCents } from '../utils/money.js';

export const click = {
  voidSale(el) {
    const order = store.data.orders.find((o) => o.id === el.dataset.id);
    if (!order) return;
    confirmDialog({
      message: `Void paid bill #${order.no} (${money(order.totals.total)})? It will be removed from paid sales. Refund the customer separately if needed.`,
      confirmLabel: 'Void sale',
      danger: true,
      onConfirm: () =>
        withManager('void a paid bill', (approver) => {
          order.status = 'void';
          order.voidedAt = Date.now();
          audit('void', `Voided paid bill #${order.no} (${money(order.totals.total)})`, approver);
          save();
          render();
          toast('Sale voided');
        }),
    });
  },
  salesTab(el) {
    store.ui.salesTab = el.dataset.tab;
    render();
  },
  trendDays(el) {
    store.ui.trendDays = Number(el.dataset.days) || 7;
    render();
  },
  showDayReport: () => showDayReport(store.ui.salesDate),
  printDayReportNow: () => printDayReportNow(store.ui.salesDate),
  exportSalesCsv() {
    const dishes = completedDishes(store.data.orders, dayRange(store.ui.salesDate));
    downloadText(`dishes-${store.ui.salesDate}.csv`, toCsv(dishCsvRows(dishes)), 'text/csv');
  },
};

/** Cash drawer boxes: blank clears the figure. */
function saveDrawer(el, key) {
  const cents = el.value === '' ? null : Math.max(0, parseCents(el.value));
  setDrawer(store.data, store.ui.salesDate, { [key]: cents });
  save();
  render();
}

export const change = {
  setDrawerFloat: (el) => saveDrawer(el, 'float'),
  setDrawerCounted: (el) => saveDrawer(el, 'counted'),
  salesDate(el) {
    store.ui.salesDate = el.value || todayStr();
    render();
  },
};
