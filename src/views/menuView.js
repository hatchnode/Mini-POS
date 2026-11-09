import { store } from '../state/store.js';
import { categoryColor } from '../ui/format.js';
import { centsToInput } from '../utils/money.js';
import { esc } from '../utils/text.js';

function categoryOptions(selectedId) {
  const { categories } = store.data;
  const none = categories.length ? '' : '<option value="">No category</option>';
  return (
    none +
    categories
      .map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`)
      .join('')
  );
}

function categoriesPanel() {
  const { categories, items } = store.data;
  const rows = categories
    .map(
      (c) => `<div class="inrow">
        <span class="dot" style="background:${categoryColor(c.id)}"></span>
        <input value="${esc(c.name)}" data-change="renameCategory" data-id="${c.id}" aria-label="Category name">
        <span class="muted small">${items.filter((i) => i.catId === c.id).length}</span>
        <button class="small btn-danger" data-act="deleteCategory" data-id="${c.id}" aria-label="Delete category">✕</button>
      </div>`,
    )
    .join('');
  return `<section class="panel"><div class="panel-h"><h2>Categories</h2></div><div class="panel-b stack">
    ${rows}
    <form class="inrow" data-submit="addCategory"><input name="cname" placeholder="New category" required><button class="btn-primary">Add</button></form>
  </div></section>`;
}

function itemsPanel() {
  const { items } = store.data;
  const rows = items
    .map(
      (i) => `<tr>
        <td><input value="${esc(i.name)}" data-change="renameItem" data-id="${i.id}" aria-label="Item name"></td>
        <td><select data-change="setItemCategory" data-id="${i.id}" aria-label="Category">${categoryOptions(i.catId)}</select></td>
        <td class="n"><input class="price" type="number" step="0.01" min="0" inputmode="decimal" value="${centsToInput(i.price)}" data-change="setItemPrice" data-id="${i.id}" aria-label="Price"></td>
        <td><input type="checkbox" ${i.active ? 'checked' : ''} data-change="setItemActive" data-id="${i.id}" aria-label="Show on menu"></td>
        <td class="acts"><button class="small btn-danger" data-act="deleteItem" data-id="${i.id}">Delete</button></td>
      </tr>`,
    )
    .join('');
  return `<section class="panel"><div class="panel-h"><h2>Items</h2><span class="muted small">${items.length} items</span></div>
    <div class="panel-b"><form class="additem" data-submit="addItem">
      <input name="iname" placeholder="Item name" required>
      <input name="iprice" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Price" required>
      <select name="icat" aria-label="Category">${categoryOptions()}</select>
      <button class="btn-primary">Add item</button>
    </form></div>
    <div class="tablewrap"><table class="t">
      <thead><tr><th>Name</th><th>Category</th><th class="n">Price</th><th>On menu</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

export function renderMenuView() {
  return `<div class="page">
    <div class="page-top"><h1>Menu</h1><span class="muted small">Changes save automatically. Prices on open orders don't change.</span></div>
    <div class="two">${categoriesPanel()}${itemsPanel()}</div>
  </div>`;
}
