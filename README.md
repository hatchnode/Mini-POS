# Mini-POS

A lightweight point-of-sale for a small restaurant. Plain JavaScript (no framework), built with [Vite](https://vite.dev). It runs entirely in the browser, works offline, and the production build is about 11 KB of gzipped JavaScript.

## Features

- **Tables & takeaway**: tap a table to start or reopen its order; open tables show their running total. Move an order to another table or turn it into a takeaway.
- **Fast ordering**: menu tiles grouped by colour-coded category, search, quantity +/−, per-item notes with quick presets ("No onions", "Extra spicy", …).
- **Kitchen screen**: "Send to kitchen" sends only items not sent yet, so add-ons go as a new ticket. Tickets turn amber after 8 minutes and red after 15.
- **No checkout step**: an order is complete, and counts as a sale, when the kitchen marks its last ticket ready. The table frees up straight away. If items were added but not sent yet, the order stays open until they are sent and marked ready too. **Recall** on a ready ticket reopens its order. Prices are final, with no tax, discount or tip.
- **Receipts**: print a bill for an open order or a receipt for a completed one, laid out for 80 mm thermal printers.
- **Sales**: any day's total sales, number of orders, average order, items sold, sales by hour, top items, and every completed order with reprint/void. Export to CSV.
- **Menu editor** and **settings** (name, address line, currency symbol, number of tables, receipt footer).
- **Backups**: export everything to JSON and import it on another device.

## Getting started

Requires Node.js 22.12 or newer (see `engines` in package.json).

```bash
npm install
npm run dev        # http://localhost:5173 with hot reload
```

| Script                 | What it does                       |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | Start the dev server               |
| `npm run build`        | Production build into `dist/`      |
| `npm run preview`      | Serve the production build locally |
| `npm test`             | Run unit tests (Vitest)            |
| `npm run test:watch`   | Tests in watch mode                |
| `npm run lint`         | ESLint                             |
| `npm run format`       | Format everything with Prettier    |
| `npm run format:check` | Check formatting (useful in CI)    |

### First run

1. **Settings**: set your restaurant name, currency and number of tables.
2. **Menu**: delete the sample items and add your own.
3. **Orders**: tap a table → tap items → **Send to kitchen**.
4. **Kitchen**: tap **Ready · complete order** when the food is done. The order is recorded as a sale and the table is free again.

## Deploying

`npm run build` produces a static `dist/` folder with relative paths, so it can be hosted anywhere static: GitHub Pages, Netlify, Cloudflare Pages, or any web server. On a tablet, open the URL and use **Add to Home Screen** to run it full-screen.

The built files must be served over HTTP; opening `dist/index.html` straight from disk won't load the JavaScript modules. Use `npm run preview` to try the build locally.

### Receipt printer

Set the thermal printer as the system default. In the browser's print dialog set margins to **None** and turn off headers/footers once. For silent printing in Chrome, launch it with `--kiosk-printing`.

## Project structure

```
├── index.html               App shell (header, containers); Vite entry
├── public/                  Static files copied as-is (favicon)
├── src/
│   ├── main.js              Bootstraps styles, events, clock and first render
│   ├── config.js            Constants: storage key, presets, ticket timings, defaults
│   ├── state/
│   │   ├── schema.js        Seed data, migrations between data versions, backup check
│   │   ├── storage.js       localStorage read/write
│   │   └── store.js         Single store: persisted `data` + screen `ui` state, save()
│   ├── domain/              Business rules: pure functions, no DOM, unit tested
│   │   ├── orders.js        Totals, lines, create/move/complete/void orders
│   │   ├── kitchen.js       Kitchen tickets; marking the last one ready completes the order
│   │   └── sales.js         Daily summary, hourly chart range, CSV rows
│   ├── views/               One render function per screen, returns HTML
│   ├── components/          Dialogs: item note, move table
│   ├── actions/             Event handlers per area, merged in actions/index.js
│   ├── ui/                  render(), event delegation, modal, toast, receipt, clock, formatting
│   ├── utils/               Small helpers: money, dates, text escaping, ids, files
│   └── styles/              CSS split by area, imported via styles/index.css
└── tests/                   Vitest unit tests for domain, schema and utils
```

### How it fits together

1. **State** lives in `store` (`src/state/store.js`). `store.data` is saved to localStorage; `store.ui` (current screen, selected table, search) is not.
2. **Views** read the store and return HTML strings. `render()` swaps the active view in and keeps scroll positions.
3. **Events** are delegated. Markup declares intent with `data-act`, `data-change`, `data-input` or `data-submit`, and `ui/events.js` calls the handler of that name from `actions/`.
4. **Actions** change state through the `domain/` functions, call `save()`, then `render()`.

To add a feature: put the rule in `domain/` with a test, add a handler in `actions/`, and render it in a `views/` file.

### Data

All money is integer cents. Data is stored under the localStorage key `mini-pos-v1` with a `version` field; `state/schema.js#migrate` upgrades older data: version 2 dropped the tax setting, and version 3 turned paid orders into completed ones when the payment step was removed. Data saved by any earlier version loads unchanged, and old orders keep their original totals on reprinted receipts.

Everything stays **on one device**. Clearing browser data erases it, so use **Settings → Export backup** regularly. Two tabs on the same device stay in sync.

## Limits

- Single device: no sync between a front-of-house tablet and a separate kitchen screen.
- No staff logins or PINs.
- No payment tracking: a completed order is assumed to be paid.
- No inventory, priced modifiers or split bills yet.
