# Mini-POS

A lightweight point-of-sale for a small restaurant. One file (`index.html`), no server, no install, no build step. Open it in a browser on a tablet or laptop and start taking orders. It works offline.

## Features

- **Tables & takeaway**: tap a table to start or reopen its order; open tables show their running total. Move an order to another table or turn it into a takeaway.
- **Fast ordering**: menu tiles grouped by colour-coded category, search, quantity +/−, per-item notes with quick chips ("No onions", "Extra spicy", …).
- **Kitchen screen**: "Send to kitchen" sends only the items that haven't been sent yet, so add-ons go as a new ticket. Tickets turn amber after 8 minutes and red after 15. Mark ready / recall.
- **Checkout**: % or fixed discount, tip (10/15/20% buttons), cash / card / other. Cash shows quick-tender buttons and the change due.
- **Receipts**: print a guest bill or a paid receipt, formatted for 80 mm thermal printers (works on normal printers too).
- **Sales**: pick any day to see total collected, net sales, tax, tips, discounts, average order, sales by hour, by payment method, top items, and every order with reprint/void. Export the day to CSV.
- **Menu editor**: add, rename, re-price, re-categorise, hide or delete items and categories. Changes save as you type; prices on orders already taken don't change.
- **Settings**: restaurant name, address line, currency symbol, tax rate, number of tables, receipt footer.
- **Backups**: export everything to a JSON file and import it on another device.

All money is handled in whole cents, so totals never drift by a cent.

## Getting started

1. Open `index.html` in Chrome, Edge or Safari (double-click it, or serve the folder with `python3 -m http.server` and visit `http://localhost:8000`).
2. Go to **Settings** and set your name, tax rate, currency and number of tables.
3. Go to **Menu**, delete the sample items and add your own.
4. **Orders** → tap a table → tap items → **Send to kitchen** → **Pay**.

### On a tablet

Host the folder anywhere static (GitHub Pages, Netlify, or a local server), open it in the tablet's browser and use **Add to Home Screen** so it opens full-screen like an app.

### Receipt printer

Set your thermal printer as the system default. In the browser's print dialog, set margins to **None** and turn off headers/footers once; the browser remembers it. For silent printing in Chrome, launch it with `--kiosk-printing`.

## Where data lives

Everything is saved in the browser's local storage **on that one device**. Clearing browser data erases it, so use **Settings → Export backup** regularly (end of each day is a good habit). Two tabs on the same device stay in sync; two different devices do not.

## Limits (by design, to stay lightweight)

- Single device: no sync between a front-of-house tablet and a separate kitchen screen.
- No staff logins or PINs.
- Card payments are recorded as "Card"; it doesn't talk to a card terminal.
- No inventory, modifiers with prices, split bills, or tax-inclusive pricing yet.

## Project layout

```
index.html   the whole app: HTML, CSS and JavaScript
README.md    this file
```

The code is plain JavaScript with no dependencies. State is one object (`S`) saved to `localStorage` under the key `mini-pos-v1`; views are rendered from it by `viewOrders`, `viewKitchen`, `viewSales`, `viewMenu` and `viewSettings`.
