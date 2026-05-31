-- Migration 002: change account_type values from admin/user/service → primary/others

PRAGMA foreign_keys = OFF;

CREATE TABLE vm_credentials_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_id         INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
  username      TEXT    NOT NULL,
  password_enc  TEXT    NOT NULL,
  password_iv   TEXT    NOT NULL,
  password_tag  TEXT    NOT NULL,
  account_type  TEXT    NOT NULL DEFAULT 'primary'
                  CHECK (account_type IN ('primary', 'others')),
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vm_id, username)
);

INSERT INTO vm_credentials_new
  SELECT
    id, vm_id, username, password_enc, password_iv, password_tag,
    CASE account_type WHEN 'admin' THEN 'primary' ELSE 'others' END,
    notes, created_at, updated_at
  FROM vm_credentials;

DROP TABLE vm_credentials;
ALTER TABLE vm_credentials_new RENAME TO vm_credentials;

PRAGMA foreign_keys = ON;
