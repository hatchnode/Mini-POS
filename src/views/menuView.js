import { isTracked, lowStockItems, stockLevel } from '../domain/stock.js';
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

/** Sold-out and low items, so the manager sees what to restock (or take off) before service. */
function lowStockPanel() {
  const low = lowStockItems(store.data, Number(store.data.settings.lowStock) || 0);
  if (!low.length) return '';
  const list = low
    .map(
      (i) =>
        `<span class="pill ${i.stock <= 0 ? 'walkout' : 'low'}">${esc(i.name)} · ${i.stock <= 0 ? 'sold out' : `${i.stock} left`}</span>`,
    )
    .join(' ');
  return `<section class="panel attention"><div class="panel-h"><h2>Running low</h2><span class="small bad"><b>${low.length}</b></span></div>
    <div class="panel-b pills">${list}</div></section>`;
}

function itemsPanel() {
  const { items, settings } = store.data;
  const lowAt = Number(settings.lowStock) || 0;
  const rows = items
    .map(
      (i) => `<tr class="stock-${stockLevel(i, lowAt) || 'none'}">
        <td><input value="${esc(i.name)}" data-change="renameItem" data-id="${i.id}" aria-label="Item name"></td>
        <td><select data-change="setItemCategory" data-id="${i.id}" aria-label="Category">${categoryOptions(i.catId)}</select></td>
        <td class="n"><input class="price" type="number" step="0.01" min="0" inputmode="decimal" value="${centsToInput(i.price)}" data-change="setItemPrice" data-id="${i.id}" aria-label="Price"></td>
        <td class="n"><input class="stock" type="number" step="1" min="0" inputmode="numeric" value="${isTracked(i) ? i.stock : ''}" placeholder="—" data-change="setItemStock" data-id="${i.id}" aria-label="Portions left (blank = not tracked)"></td>
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
      <thead><tr><th>Name</th><th>Category</th><th class="n">Price</th><th class="n">Left</th><th>On menu</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

export function renderMenuView() {
  return `<div class="page">
    <div class="page-top"><h1>Menu</h1><span class="muted small">Changes save automatically. Prices on open orders don't change. <b>Left</b>: type how many portions you have to count them down as they are ordered (0 = sold out); leave blank for items you never run out of.</span></div>
    ${lowStockPanel()}
    <div class="two">${categoriesPanel()}${itemsPanel()}</div>
  </div>`;
}
