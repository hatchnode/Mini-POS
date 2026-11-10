import { isTracked, parseStock } from '../domain/stock.js';
import { uid } from '../utils/id.js';
import { save, store } from '../state/store.js';
import { confirmDialog } from '../ui/modal.js';
import { render } from '../ui/render.js';
import { toast } from '../ui/toast.js';
import { $ } from '../utils/dom.js';
import { centsToInput, parseCents } from '../utils/money.js';

const findItem = (id) => store.data.items.find((i) => i.id === id);
const findCategory = (id) => store.data.categories.find((c) => c.id === id);

function saved(message = 'Saved') {
  save();
  toast(message);
}

export const click = {
  deleteCategory(el) {
    const cat = findCategory(el.dataset.id);
    if (!cat) return;
    const count = store.data.items.filter((i) => i.catId === cat.id).length;
    const remove = () => {
      store.data.categories = store.data.categories.filter((c) => c !== cat);
      store.data.items = store.data.items.filter((i) => i.catId !== cat.id);
      if (store.ui.category === cat.id) store.ui.category = 'all';
      save();
      render();
    };
    if (!count) return remove();
    confirmDialog({
      message: `Delete "${cat.name}" and its ${count} item${count > 1 ? 's' : ''}? Past orders are not affected.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: remove,
    });
  },
  deleteItem(el) {
    const item = findItem(el.dataset.id);
    if (!item) return;
    confirmDialog({
      message: `Delete "${item.name}" from the menu? Past orders are not affected. (Tip: untick "On menu" to hide it instead.)`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        store.data.items = store.data.items.filter((i) => i !== item);
        save();
        render();
      },
    });
  },
};

export const change = {
  renameCategory(el) {
    const cat = findCategory(el.dataset.id);
    if (!cat) return;
    cat.name = el.value.trim() || cat.name;
    el.value = cat.name;
    saved();
  },
  renameItem(el) {
    const item = findItem(el.dataset.id);
    if (!item) return;
    item.name = el.value.trim() || item.name;
    el.value = item.name;
    saved();
  },
  setItemCategory(el) {
    const item = findItem(el.dataset.id);
    if (!item) return;
    item.catId = el.value || null;
    saved();
  },
  setItemPrice(el) {
    const item = findItem(el.dataset.id);
    if (!item) return;
    item.price = Math.max(0, parseCents(el.value));
    el.value = centsToInput(item.price);
    saved();
  },
  /** Blank = don't track; a number = portions left (0 = sold out). */
  setItemStock(el) {
    const item = findItem(el.dataset.id);
    if (!item) return;
    const stock = parseStock(el.value);
    if (stock == null) delete item.stock;
    else item.stock = stock;
    save();
    render();
    if (!isTracked(item)) toast(`${item.name}: stock not tracked`);
    else toast(stock === 0 ? `${item.name} marked sold out` : `${item.name}: ${stock} left`);
  },
  setItemActive(el) {
    const item = findItem(el.dataset.id);
    if (!item) return;
    item.active = el.checked;
    saved(item.active ? 'Shown on menu' : 'Hidden from menu');
  },
};

export const submit = {
  addCategory(form) {
    const name = form.elements.cname.value.trim();
    if (!name) return;
    store.data.categories.push({ id: uid(), name });
    save();
    render();
    $('form[data-submit=addCategory] input')?.focus();
  },
  addItem(form) {
    const name = form.elements.iname.value.trim();
    if (!name) return;
    const catId = form.elements.icat.value || null;
    store.data.items.push({
      id: uid(),
      name,
      price: Math.max(0, parseCents(form.elements.iprice.value)),
      catId,
      active: true,
    });
    save();
    render();
    toast(`Added ${name}`);
    // Keep the chosen category for the next item and put the cursor back in the name field.
    const select = $('form[data-submit=addItem] select');
    if (select && catId) select.value = catId;
    $('form[data-submit=addItem] input[name=iname]')?.focus();
  },
};
