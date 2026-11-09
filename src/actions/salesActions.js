import { salesCsvRows, summarizeSales } from '../domain/sales.js';
import { save, store } from '../state/store.js';
import { money } from '../ui/format.js';
import { confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { dayRange, todayStr } from '../utils/date.js';
import { downloadText, toCsv } from '../utils/file.js';

export const click = {
  voidSale(el) {
    const order = store.data.orders.find((o) => o.id === el.dataset.id);
    if (!order) return;
    confirmDialog({
      message: `Void completed order #${order.no} (${money(order.totals.total)})? It will be excluded from sales.`,
      confirmLabel: 'Void sale',
      danger: true,
      onConfirm: () => {
        order.status = 'void';
        order.voidedAt = Date.now();
        save();
        render();
        toast('Sale voided');
      },
    });
  },
  exportSalesCsv() {
    const { orders } = summarizeSales(store.data.orders, dayRange(store.ui.salesDate));
    downloadText(`sales-${store.ui.salesDate}.csv`, toCsv(salesCsvRows(orders)), 'text/csv');
  },
};

export const change = {
  salesDate(el) {
    store.ui.salesDate = el.value || todayStr();
    render();
  },
};
