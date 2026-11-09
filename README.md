# Mini-POS

A lightweight point-of-sale for a small restaurant. Plain JavaScript (no framework), built with [Vite](https://vite.dev). It runs entirely in the browser, works offline, and the production build is about 11 KB of gzipped JavaScript.

## Features

- **Tables & takeaway**: tap a table to start or reopen its order; open tables show their running total. **New takeaway** starts an order with no table (food to go); it appears under "Takeaway & other" once you add the first item. Move an order to another table or turn it into a takeaway.
- **Manage tables**: on the Orders screen tap **Edit tables**, then tap **+** to add a table, or tap a table to rename it (e.g. "Patio", "Bar 2") or remove it. Tables with an open order can't be removed. Finished orders keep their table name.
- **Fast ordering**: menu tiles grouped by colour-coded category, search, quantity +/−, per-item notes with quick presets ("No onions", "Extra spicy", …).
- **Per-dish kitchen orders**: "Send to kitchen" turns each line into its own dish order ("2× Burger" sent together is one dish), stamped with the time it was sent. The kitchen screen groups dishes by table, and each dish has its own timer (amber after 8 minutes, red after 15) and its own **Ready** button, which records that dish's completion time. Items added later are sent as new dishes with their own times.
- **No checkout step**: a table frees by itself when every dish on it is ready and nothing is waiting to be sent. The bill is then complete. **Recall** puts a ready dish back in the kitchen and reopens its table if needed. Removing a dish that is still cooking takes it off the kitchen screen. Prices are final, with no tax, discount or tip.
- **Receipts**: **Print bill** (open table) or **Receipt** (Sales) shows the receipt on screen; **Print** sends it to the printer. Laid out for 80 mm thermal printers, and works with any printer or "Save as PDF".
- **Order times**: every dish logs when it was ordered (sent) and when the kitchen completed it. Each order line on the ticket shows how many are not sent, cooking or ready.
- **Sales**: each dish counts as a sale when it is marked ready. For any day you see total sales, dishes completed, average dish time, tables served, sales by hour, top items, a **dish log** (ordered, completed and time taken for every dish) and the day's bills with reprint/void. Export the dish log to CSV.
- **Menu editor** and **settings** (name, location, phone, currency symbol, receipt footer). The bottom of every receipt shows the restaurant name, location and phone.
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

1. **Settings**: set your restaurant name, location, phone and currency.
   Then on **Orders**, tap **Edit tables** to add, rename or remove tables.
2. **Menu**: delete the sample items and add your own.
3. **Orders**: tap a table → tap items → **Send to kitchen**.
4. **Kitchen**: tap **Ready** on each dish as it's done. The last dish of a table shows **Ready · complete order**, which frees the table.

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
│   │   ├── tables.js        Add, rename and remove tables; table labels
│   │   ├── kitchen.js       Per-dish kitchen orders: send, ready, recall, cancel, queue
│   │   └── sales.js         Daily summary, hourly chart range, CSV rows
│   ├── views/               One render function per screen, returns HTML
│   ├── components/          Dialogs: item note, move table, edit table
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

All money is integer cents. Data is stored under the localStorage key `mini-pos-v1` with a `version` field; `state/schema.js#migrate` upgrades older data: version 2 dropped the tax setting, version 3 turned paid orders into completed ones when the payment step was removed, version 4 moved kitchen tickets onto each order as per-dish records (`order.dishes`), and version 5 replaced the "number of tables" setting with a managed table list (`data.tables`). Data saved by any earlier version loads unchanged, and old orders keep their original totals on reprinted receipts.

Everything stays **on one device**. Clearing browser data erases it, so use **Settings → Export backup** regularly. Two tabs on the same device stay in sync.

## Limits

- Single device: no sync between a front-of-house tablet and a separate kitchen screen.
- No staff logins or PINs.
- No payment tracking: a completed dish or table is assumed to be paid.
- No inventory, priced modifiers or split bills yet.
