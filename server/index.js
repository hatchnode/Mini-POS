#!/usr/bin/env node
/**
 * Mini-POS server for one restaurant's local network. Run it on one computer; tablets and the
 * kitchen screen open it in their browser. All data is kept in a SQLite file on this computer.
 *
 *   node server/index.js [--port 8080] [--data ./data] [--host 0.0.0.0]
 *
 * HTTPS: put cert.pem and key.pem in the data folder and the server uses them.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Store } from './store.js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : process.env[`MINI_POS_${name.toUpperCase()}`] || fallback;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(option('port', 8080));
const host = option('host', '0.0.0.0');
const dataDir = resolve(option('data', join(root, 'data')));
const staticDir = join(root, 'dist');
const BACKUPS_KEPT = 14;

mkdirSync(join(dataDir, 'backups'), { recursive: true });
const store = new Store(join(dataDir, 'mini-pos.db'));

/** One copy of the database per day in data/backups, keeping the last two weeks. */
function dailyBackup() {
  const day = new Date().toISOString().slice(0, 10);
  const file = join(dataDir, 'backups', `mini-pos-${day}.db`);
  try {
    if (!existsSync(file)) store.backupTo(file);
    const old = readdirSync(join(dataDir, 'backups'))
      .filter((f) => /^mini-pos-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .sort()
      .slice(0, -BACKUPS_KEPT);
    old.forEach((f) => unlinkSync(join(dataDir, 'backups', f)));
  } catch (error) {
    console.error('Backup failed:', error.message);
  }
}
dailyBackup();
setInterval(dailyBackup, 3600000).unref();

const certFile = join(dataDir, 'cert.pem');
const keyFile = join(dataDir, 'key.pem');
const secure = existsSync(certFile) && existsSync(keyFile);
const app = createApp({ store, staticDir: existsSync(staticDir) ? staticDir : null, secure });
const server = secure
  ? createHttpsServer({ cert: readFileSync(certFile), key: readFileSync(keyFile) }, app)
  : createHttpServer(app);

server.listen(port, host, () => {
  const scheme = secure ? 'https' : 'http';
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => `${scheme}://${n.address}:${port}`);
  console.log(`Mini-POS server is running. Data: ${join(dataDir, 'mini-pos.db')}`);
  console.log(`  On this computer:  ${scheme}://localhost:${port}`);
  addresses.forEach((a) => console.log(`  On other devices:  ${a}`));
  if (!existsSync(staticDir)) console.log('  The app is not built yet. Run "npm run build" first.');
  if (!secure) console.log('  Using plain HTTP. See the README to turn on HTTPS.');
  if (!store.getMeta('owner_password'))
    console.log('  First run: open the app to choose the owner password.');
});

const stop = () => {
  server.close();
  store.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
