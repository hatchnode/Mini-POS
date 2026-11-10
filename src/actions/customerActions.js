import { customerResults, openCustomerDialog } from '../components/customerDialog.js';
import {
  addCustomer,
  attachCustomer,
  customerStats,
  detachCustomer,
  findCustomer,
  redeemReward,
  removeCustomer,
  rewardStatus,
  updateCustomer,
} from '../domain/customers.js';
import { currentOrder, save, store } from '../state/store.js';
import { audit } from '../ui/access.js';
import { closeModal, confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';

function attach(customer) {
  const order = currentOrder();
  if (!order) return;
  attachCustomer(order, customer);
  save();
  closeModal();
  render();
  toast(`${customer.name} added to this order`);
}

export const click = {
  openCustomerDialog: () => openCustomerDialog(),
  pickCustomer(el) {
    const customer = findCustomer(store.data, el.dataset.id);
    if (customer) attach(customer);
  },
  removeOrderCustomer() {
    const order = currentOrder();
    if (!order) return;
    if (!detachCustomer(order)) return toast('Remove the reward from the bill first');
    save();
    render();
  },
  /** Add the customer's reward to the bill as a free line. */
  redeemReward() {
    const order = currentOrder();
    const customer = order && findCustomer(store.data, order.customerId);
    if (!customer) return;
    const { loyaltyVisits, loyaltyReward } = store.data.settings;
    const visits = customerStats(store.data).get(customer.id)?.visits || 0;
    if (!rewardStatus(customer, visits, Number(loyaltyVisits))?.due) return toast('No reward due yet');
    const result = redeemReward(order, customer, loyaltyReward || 'Reward');
    if (!result.ok) return toast(result.error);
    audit('reward', `Reward for ${customer.name}: ${loyaltyReward || 'Reward'} · order #${order.no}`);
    save();
    render();
    toast(`Reward added for ${customer.name}. Send it to the kitchen.`);
  },
  deleteCustomer(el) {
    const customer = findCustomer(store.data, el.dataset.id);
    if (!customer) return;
    confirmDialog({
      message: `Delete ${customer.name}? Their visits and reward progress are forgotten. Past orders are kept.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        removeCustomer(store.data, customer.id);
        save();
        render();
        toast(`Deleted ${customer.name}`);
      },
    });
  },
};

function edit(el, patch) {
  const result = updateCustomer(store.data, el.dataset.id, patch);
  if (!result.ok) {
    toast(result.error);
    return render();
  }
  save();
  toast('Saved');
}

export const change = {
  renameCustomer: (el) => edit(el, { name: el.value }),
  setCustomerPhone: (el) => edit(el, { phone: el.value }),
};

export const input = {
  searchCustomer(el) {
    $('#cust-results').innerHTML = customerResults(el.value); // keep focus in the search box
  },
};

export const submit = {
  /** From the ticket's customer dialog: add and put them on the order. */
  addOrderCustomer(form) {
    const result = addCustomer(store.data, {
      name: form.elements.cname.value,
      phone: form.elements.cphone.value,
    });
    if (!result.ok) return toast(result.error);
    attach(result.customer);
  },
  /** From Sales → Customers. */
  addCustomer(form) {
    const result = addCustomer(store.data, {
      name: form.elements.cname.value,
      phone: form.elements.cphone.value,
    });
    if (!result.ok) return toast(result.error);
    save();
    render();
    toast(`Added ${result.customer.name}`);
  },
};
