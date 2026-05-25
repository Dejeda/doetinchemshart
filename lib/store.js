// JSON state backed by libSQL/Turso. Local dev defaults to a file: URL
// (creates data/local.db). Production uses TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
//
// Schema is intentionally minimal: a key-value table holding JSON blobs.
// Reads are cached in memory; writes are serial per key.

const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const KNOWN_KEYS = ['users.json', 'agenda.json', 'announcements.json'];
const cache = new Map();
const writeLocks = new Map();
let db = null;
let initialized = false;

function defaultLocalUrl() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return `file:${path.join(dataDir, 'local.db')}`;
}

async function init(defaults = {}) {
  const url = process.env.TURSO_DATABASE_URL || defaultLocalUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

  db = createClient({ url, authToken });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  cache.clear();
  for (const name of KNOWN_KEYS) {
    const res = await db.execute({ sql: 'SELECT data FROM app_state WHERE name = ?', args: [name] });
    if (res.rows.length > 0) {
      try {
        cache.set(name, JSON.parse(res.rows[0].data));
      } catch (e) {
        console.error(`[store] Kon ${name} niet parsen: ${e.message}`);
        cache.set(name, defaults[name] !== undefined ? defaults[name] : []);
      }
    } else if (defaults[name] !== undefined) {
      cache.set(name, defaults[name]);
      await persist(name, defaults[name]);
      console.log(`[store] ${name} (default) opgeslagen`);
    } else {
      cache.set(name, []);
    }
  }

  initialized = true;
  const target = url.startsWith('file:') ? `lokale SQLite (${url})` : `Turso (${url.replace(/\?.*/, '')})`;
  console.log(`[store] Verbonden met ${target}`);
}

async function persist(name, data) {
  await db.execute({
    sql: `INSERT INTO app_state (name, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: [name, JSON.stringify(data), new Date().toISOString()],
  });
}

function readJson(name, fallback) {
  if (!initialized) throw new Error('Store nog niet geïnitialiseerd');
  return cache.has(name) ? cache.get(name) : fallback;
}

async function writeJson(name, data) {
  if (!initialized) throw new Error('Store nog niet geïnitialiseerd');
  cache.set(name, data);
  const prev = writeLocks.get(name) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => persist(name, data));
  writeLocks.set(name, next);
  return next;
}

function nextId(items) {
  return items.reduce((max, it) => Math.max(max, Number(it.id) || 0), 0) + 1;
}

module.exports = { init, readJson, writeJson, nextId };
