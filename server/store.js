/**
 * The database: one SQLite file. Every record of the app (an order, a menu item, a customer…)
 * is a row in `records`, holding the record as JSON plus a revision number that goes up with
 * every change anywhere, which is what lets devices ask "what changed since I last looked?".
 *
 *   records      collection, id, doc (JSON), rev, deleted, updated_at
 *   meta         small named values: owner password hash, server id, revision counter
 *   devices      devices allowed to connect (token hash, name, who is signed in)
 *   staff_pins   PIN hashes, kept apart from the staff records so they are never sent to a device
 *
 * Read-only views (orders, order_lines, menu_items, payments) present the JSON as ordinary
 * columns for anyone opening the file with a SQLite tool.
 */
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    doc TEXT,
    rev INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (collection, id)
  );
  CREATE INDEX IF NOT EXISTS records_rev ON records (rev);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS devices (
    token_hash TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    staff_id TEXT
  );
  CREATE TABLE IF NOT EXISTS staff_pins (staff_id TEXT PRIMARY KEY, pin_hash TEXT NOT NULL);

  CREATE VIEW IF NOT EXISTS orders AS
    SELECT id,
      json_extract(doc, '$.no') AS number,
      json_extract(doc, '$.tableName') AS table_name,
      json_extract(doc, '$.status') AS status,
      datetime(json_extract(doc, '$.createdAt') / 1000, 'unixepoch') AS created_at,
      datetime(json_extract(doc, '$.paidAt') / 1000, 'unixepoch') AS paid_at,
      json_extract(doc, '$.paidAmount') / 100.0 AS paid_amount,
      json_extract(doc, '$.staff') AS staff,
      json_extract(doc, '$.customerName') AS customer
    FROM records WHERE collection = 'orders' AND deleted = 0;
  CREATE VIEW IF NOT EXISTS order_lines AS
    SELECT r.id AS order_id,
      json_extract(l.value, '$.name') AS name,
      json_extract(l.value, '$.qty') AS qty,
      json_extract(l.value, '$.price') / 100.0 AS price,
      json_extract(l.value, '$.note') AS note
    FROM records r, json_each(r.doc, '$.lines') l WHERE r.collection = 'orders' AND r.deleted = 0;
  CREATE VIEW IF NOT EXISTS payments AS
    SELECT r.id AS order_id,
      datetime(json_extract(p.value, '$.at') / 1000, 'unixepoch') AS paid_at,
      json_extract(p.value, '$.amount') / 100.0 AS amount,
      json_extract(p.value, '$.method') AS method,
      json_extract(p.value, '$.staff') AS staff
    FROM records r, json_each(r.doc, '$.payments') p WHERE r.collection = 'orders' AND r.deleted = 0;
  CREATE VIEW IF NOT EXISTS menu_items AS
    SELECT id,
      json_extract(doc, '$.name') AS name,
      json_extract(doc, '$.price') / 100.0 AS price,
      json_extract(doc, '$.active') AS on_menu,
      json_extract(doc, '$.stock') AS stock_left
    FROM records WHERE collection = 'items' AND deleted = 0;
`;

export class Store {
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(SCHEMA);
    if (!this.getMeta('server_id')) this.setMeta('server_id', randomUUID());
    this.q = {
      get: this.db.prepare('SELECT doc, rev, deleted FROM records WHERE collection = ? AND id = ?'),
      put: this.db.prepare(
        `INSERT INTO records (collection, id, doc, rev, deleted, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (collection, id) DO UPDATE SET doc = excluded.doc, rev = excluded.rev,
           deleted = excluded.deleted, updated_at = excluded.updated_at`,
      ),
      since: this.db.prepare(
        'SELECT collection, id, doc, rev, deleted FROM records WHERE rev > ? ORDER BY rev',
      ),
      live: this.db.prepare('SELECT id, doc FROM records WHERE collection = ? AND deleted = 0'),
      count: this.db.prepare('SELECT COUNT(*) AS n FROM records WHERE collection = ? AND deleted = 0'),
    };
  }

  close() {
    this.db.close();
  }

  getMeta(key) {
    return this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
  }

  setMeta(key, value) {
    this.db
      .prepare(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      )
      .run(key, String(value));
  }

  get serverId() {
    return this.getMeta('server_id');
  }

  /** The latest revision number. */
  get rev() {
    return Number(this.getMeta('rev')) || 0;
  }

  /** Run several changes as one: all of them are saved, or none. */
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** { doc, rev, deleted } for a record, or null if it has never existed. */
  get(collection, id) {
    const row = this.q.get.get(collection, id);
    return row
      ? { doc: row.deleted ? null : JSON.parse(row.doc), rev: row.rev, deleted: !!row.deleted }
      : null;
  }

  /** Save a record (`doc` null deletes it) under the next revision number. Returns that number. */
  put(collection, id, doc, now = Date.now()) {
    const rev = this.rev + 1;
    this.q.put.run(collection, id, doc == null ? null : JSON.stringify(doc), rev, doc == null ? 1 : 0, now);
    this.setMeta('rev', rev);
    return rev;
  }

  /** Every record changed after revision `since`, oldest change first. Deleted ones have doc null. */
  changesSince(since) {
    return this.q.since.all(Number(since) || 0).map((row) => ({
      collection: row.collection,
      id: row.id,
      rev: row.rev,
      doc: row.deleted ? null : JSON.parse(row.doc),
    }));
  }

  /** All current records of a collection as [{ id, ...doc }]. */
  all(collection) {
    return this.q.live.all(collection).map((row) => JSON.parse(row.doc));
  }

  count(collection) {
    return this.q.count.get(collection).n;
  }

  /** Write a consistent copy of the database to another file (used for the daily backups). */
  backupTo(path) {
    this.db.exec(`VACUUM INTO '${path.replaceAll("'", "''")}'`);
  }
}
