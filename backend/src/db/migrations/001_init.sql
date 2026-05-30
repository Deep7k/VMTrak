-- VMTrak initial schema
-- Migration 001

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'support' CHECK (role IN ('admin', 'support')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- Refresh tokens
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- VMs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Identity
  vm_name       TEXT NOT NULL UNIQUE,
  vm_tag        TEXT,
  description   TEXT,

  -- Infrastructure
  hypervisor    TEXT,
  cluster       TEXT,
  datacenter    TEXT,

  -- OS
  os_type       TEXT CHECK (os_type IN ('Windows', 'Linux', 'Other') OR os_type IS NULL),
  os_version    TEXT,
  hostname      TEXT,

  -- Network
  ip_address    TEXT,
  vlan          TEXT,
  mac_address   TEXT,

  -- Resources
  vcpu          INTEGER,
  ram_gb        REAL,
  disk_gb       REAL,

  -- State
  power_state   TEXT NOT NULL DEFAULT 'unknown'
                  CHECK (power_state IN ('on', 'off', 'suspended', 'unknown')),
  environment   TEXT CHECK (environment IN ('production', 'staging', 'development', 'test') OR environment IS NULL),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'decommissioned', 'maintenance')),

  -- Ownership
  owner         TEXT,
  department    TEXT,
  application   TEXT,

  -- Lifecycle
  expiry_date   TEXT,
  notes         TEXT,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_by    INTEGER REFERENCES users(id),
  updated_by    INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_vms_status      ON vms(status);
CREATE INDEX IF NOT EXISTS idx_vms_environment ON vms(environment);
CREATE INDEX IF NOT EXISTS idx_vms_expiry_date ON vms(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vms_ip_address  ON vms(ip_address);

-- ─────────────────────────────────────────────
-- VM Credentials
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vm_credentials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_id         INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
  username      TEXT    NOT NULL,
  password_enc  TEXT    NOT NULL,
  password_iv   TEXT    NOT NULL,
  password_tag  TEXT    NOT NULL,
  account_type  TEXT    NOT NULL DEFAULT 'user'
                  CHECK (account_type IN ('admin', 'user', 'service')),
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vm_id, username)
);

-- ─────────────────────────────────────────────
-- Audit logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  username    TEXT,
  action      TEXT    NOT NULL,
  entity_type TEXT,
  entity_id   INTEGER,
  entity_name TEXT,
  detail      TEXT,
  ip_address  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_user_id     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs(created_at);

-- ─────────────────────────────────────────────
-- Notification log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_id       INTEGER NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
  notice_type TEXT    NOT NULL CHECK (notice_type IN ('30d', '14d', '7d', '1d', 'expired')),
  sent_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  recipient   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_vm_id ON notification_log(vm_id);
