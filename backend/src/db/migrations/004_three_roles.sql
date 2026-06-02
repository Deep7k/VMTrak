-- Migration 004: replace admin/support with admin/readwrite/read role system
-- SQLite cannot ALTER a CHECK constraint, so we rebuild the users table.

PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT    NOT NULL UNIQUE,
  email                TEXT    NOT NULL UNIQUE,
  password_hash        TEXT    NOT NULL,
  role                 TEXT    NOT NULL DEFAULT 'readwrite'
                         CHECK (role IN ('admin', 'readwrite', 'read')),
  is_active            INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Copy existing rows; map legacy 'support' -> 'readwrite'
INSERT INTO users_new (id, username, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
SELECT
  id, username, email, password_hash,
  CASE role WHEN 'support' THEN 'readwrite' ELSE role END,
  is_active, must_change_password, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

PRAGMA foreign_keys = ON;
