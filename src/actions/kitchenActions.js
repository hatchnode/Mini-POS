import { markDishReady, recallDish } from '../domain/kitchen.js';
import { balanceDue, orderLabel } from '../domain/orders.js';
import { save, store } from '../state/store.js';
import { money } from '../ui/format.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';

/** Kitchen buttons carry both ids: data-order (the bill) and data-id (the dish). */
const findOrder = (el) => store.data.orders.find((o) => o.id === el.dataset.order);

export const click = {
  markDishReady(el) {
    const order = findOrder(el);
    if (!order) return;
    const { dish, served, completed } = markDishReady(order, el.dataset.id);
    if (!dish) return;
    if (completed && store.ui.currentOrderId === order.id) store.ui.currentOrderId = null;
    save();
    render();
    let message = `${dish.qty}× ${dish.name} ready`;
    if (completed)
      message = `${orderLabel(order)} #${order.no} served and paid.${order.table ? ' Table is free.' : ''}`;
    else if (served)
      message = `${orderLabel(order)} #${order.no} served. Awaiting payment of ${money(balanceDue(order))}.`;
    toast(message, 2600);
  },
  recallDish(el) {
    const order = findOrder(el);
    if (!order) return;
    const { dish, reopened } = recallDish(order, el.dataset.id);
    if (!dish) return;
    save();
    render();
    toast(
      reopened
        ? `${dish.name} back in the kitchen · ${orderLabel(order)} #${order.no} reopened`
        : `${dish.name} back in the kitchen`,
    );
  },
  toggleReadyDishes() {
    store.ui.showReadyDishes = !store.ui.showReadyDishes;
    render();
  },
};
