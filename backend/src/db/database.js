'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');

// ── Path configuration ────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_PATH  = path.join(DATA_DIR, 'inventory.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Open database ─────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ── Run migrations ────────────────────────────────────────────────────────────
function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Track applied migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = db.prepare('SELECT name FROM _migrations').all().map(r => r.name);

  for (const file of migrationFiles) {
    if (applied.includes(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      db.exec(sql);
    } catch (err) {
      // Tolerate "duplicate column" errors so a migration that partially ran
      // on a previous deploy (column added but _migrations not recorded) doesn't
      // prevent startup. Any other error is still fatal.
      if (!err.message?.includes('duplicate column name')) throw err;
      console.warn(`[db] Migration ${file}: skipped (column already exists)`);
    }
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`[db] Applied migration: ${file}`);
  }
}

// ── Seed default admin ────────────────────────────────────────────────────────
async function seedAdminUser() {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (existing) return;

  const hash = await bcrypt.hash('changeme', 12);
  db.prepare(`
    INSERT INTO users (username, email, password_hash, role, must_change_password)
    VALUES ('admin', 'admin@localhost', ?, 'admin', 1)
  `).run(hash);

  console.log('[db] Seeded default admin user (admin / changeme) — change this password immediately.');
}

// ── Initialise ────────────────────────────────────────────────────────────────
async function initDb() {
  runMigrations();
  db.pragma('foreign_keys = ON'); // re-enable after any migration that disables it
  await seedAdminUser();
}

module.exports = { db, initDb };
