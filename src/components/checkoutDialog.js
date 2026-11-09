import { PAYMENT_METHODS, TIP_PRESETS } from '../config.js';
import { calcTotals, orderLabel, setDiscount } from '../domain/orders.js';
import { completePayment, quickTenderOptions, tipFromPercent } from '../domain/payments.js';
import { clearSelection, currentOrder, save, store } from '../state/store.js';
import { money } from '../ui/format.js';
import { closeButton, openModal } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $, $$ } from '../utils/dom.js';
import { centsToInput, parseCents } from '../utils/money.js';
import { capitalize, esc } from '../utils/text.js';

/** Checkout form state that isn't part of the order itself. */
const form = { method: 'cash', tendered: 0 };

export function openCheckout() {
  const order = currentOrder();
  if (!order || !order.lines.length) return;
  form.method = 'cash';
  form.tendered = 0;

  const currency = esc(store.data.settings.currency);
  const d = order.discount;
  const discountValue = d ? (d.type === 'pct' ? d.value : centsToInput(d.value)) : '';
  const methods = PAYMENT_METHODS.map(
    (m) =>
      `<button data-act="setPaymentMethod" data-m="${m}" class="${m === form.method ? 'on' : ''}">${capitalize(m)}</button>`,
  ).join('');
  const tips = TIP_PRESETS.map((p) => `<button data-act="applyTipPercent" data-p="${p}">${p}%</button>`).join(
    '',
  );

  openModal(`
    <div class="mh"><h3>Checkout · ${esc(orderLabel(order))} #${order.no}</h3>${closeButton}</div>
    <div class="mb">
      <div class="grid2">
        <label class="fld">Discount
          <div class="inrow">
            <input id="disc-val" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${discountValue}" data-input="checkout">
            <select id="disc-type" data-change="checkout" aria-label="Discount type">
              <option value="pct">%</option>
              <option value="amt" ${d?.type === 'amt' ? 'selected' : ''}>${currency}</option>
            </select>
          </div>
        </label>
        <div class="fld"><label for="tip-val">Tip (${currency})</label>
          <input id="tip-val" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${order.tip ? centsToInput(order.tip) : ''}" data-input="checkout">
          <div class="quick">${tips}</div>
        </div>
      </div>
      <div class="sumbox">
        <div class="row"><span>Subtotal</span><span id="co-sub"></span></div>
        <div class="row"><span>Discount</span><span id="co-disc"></span></div>
        <div class="row"><span>Tip</span><span id="co-tip"></span></div>
        <div class="row total"><span>Total</span><span id="co-total"></span></div>
      </div>
      <div class="seg" id="co-methods">${methods}</div>
      <div id="cash-box" class="stack">
        <label class="fld">Cash received
          <input id="tendered" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" data-input="checkout">
        </label>
        <div class="quick" id="cash-quick"></div>
        <div class="row total"><span>Change due</span><span id="co-change">—</span></div>
      </div>
    </div>
    <div class="mf"><button data-act="closeModal">Cancel</button><button class="btn-ok" id="co-submit" data-act="submitPayment">Complete payment</button></div>`);
  refreshCheckout();
}

/** Copy form inputs onto the order (discount, tip) and the form state (cash received). */
function readForm() {
  const order = currentOrder();
  if (!order || !$('#disc-val')) return null;
  const type = $('#disc-type').value;
  const raw = parseFloat($('#disc-val').value) || 0;
  setDiscount(order, type, type === 'pct' ? raw : parseCents(raw));
  order.tip = Math.max(0, parseCents($('#tip-val').value));
  form.tendered = Math.max(0, parseCents($('#tendered').value));
  return order;
}

/** Recalculate totals and change without re-rendering inputs (so focus isn't lost while typing). */
export function refreshCheckout() {
  const order = readForm();
  if (!order) return;
  const t = calcTotals(order);
  const cash = form.method === 'cash';

  $('#co-sub').textContent = money(t.subtotal);
  $('#co-disc').textContent = money(-t.discount);
  $('#co-tip').textContent = money(t.tip);
  $('#co-total').textContent = money(t.total);
  $('#cash-box').hidden = !cash;

  if (cash) {
    $('#cash-quick').innerHTML = quickTenderOptions(t.total)
      .map((v, i) => `<button data-act="setTendered" data-v="${v}">${i === 0 ? 'Exact' : money(v)}</button>`)
      .join('');
    const change = form.tendered - t.total;
    const el = $('#co-change');
    el.textContent = form.tendered ? (change >= 0 ? money(change) : `Short ${money(-change)}`) : '—';
    el.classList.toggle('bad', form.tendered > 0 && change < 0);
  }
  $('#co-submit').disabled = cash && form.tendered < t.total;
  save();
}

export function setPaymentMethod(button) {
  form.method = button.dataset.m;
  $$('#co-methods button').forEach((b) => b.classList.toggle('on', b === button));
  refreshCheckout();
}

export function applyTipPercent(pct) {
  const order = readForm();
  if (!order) return;
  $('#tip-val').value = centsToInput(tipFromPercent(order, pct));
  refreshCheckout();
}

export function setTendered(cents) {
  $('#tendered').value = centsToInput(cents);
  refreshCheckout();
}

export function submitPayment() {
  const order = readForm();
  if (!order) return;
  const result = completePayment(order, { method: form.method, tendered: form.tendered });
  if (!result.ok) {
    toast(result.error);
    return;
  }
  clearSelection();
  save();
  render();

  const { payment, totals } = order;
  const headline =
    payment.method === 'cash'
      ? `<div class="muted">Change due</div><div class="huge">${money(payment.change)}</div>`
      : '<div class="huge ok">✓ Paid</div>';
  openModal(`
    <div class="mh"><h3>Payment complete</h3></div>
    <div class="mb center">${headline}
      <div>${esc(orderLabel(order))} · #${order.no} · ${money(totals.total)} by ${payment.method}</div>
    </div>
    <div class="mf"><button data-act="printReceipt" data-id="${order.id}">Print receipt</button><button class="btn-primary" data-act="closeModal">Done</button></div>`);
}
