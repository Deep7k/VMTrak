-- Fix vms CHECK constraint: replace 'maintenance' with 'inactive'
-- Migration 010 renamed the data but could not ALTER the CHECK constraint
-- (SQLite does not support DROP CONSTRAINT), so we recreate the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE vms_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vm_name       TEXT NOT NULL UNIQUE,
  vm_tag        TEXT,
  description   TEXT,
  hypervisor    TEXT,
  cluster       TEXT,
  datacenter    TEXT,
  os_type       TEXT CHECK (os_type IN ('Windows', 'Linux', 'Other') OR os_type IS NULL),
  os_version    TEXT,
  hostname      TEXT,
  ip_address    TEXT,
  vlan          TEXT,
  mac_address   TEXT,
  vcpu          INTEGER,
  ram_gb        REAL,
  disk_gb       REAL,
  power_state   TEXT NOT NULL DEFAULT 'unknown'
                  CHECK (power_state IN ('on', 'off', 'suspended', 'unknown')),
  environment   TEXT CHECK (environment IN ('production', 'staging', 'development', 'test') OR environment IS NULL),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'decommissioned')),
  owner         TEXT,
  department    TEXT,
  application   TEXT,
  expiry_date   TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_by    INTEGER REFERENCES users(id),
  updated_by    INTEGER REFERENCES users(id),
  hypervisor_id INTEGER REFERENCES hypervisors(id) ON DELETE SET NULL,
  deleted_at    TEXT,
  deleted_by    INTEGER REFERENCES users(id),
  delete_reason TEXT
);

INSERT INTO vms_new SELECT
  id, vm_name, vm_tag, description, hypervisor, cluster, datacenter,
  os_type, os_version, hostname, ip_address, vlan, mac_address,
  vcpu, ram_gb, disk_gb, power_state, environment, status,
  owner, department, application, expiry_date, notes,
  created_at, updated_at, created_by, updated_by,
  hypervisor_id, deleted_at, deleted_by, delete_reason
FROM vms;

DROP TABLE vms;
ALTER TABLE vms_new RENAME TO vms;

CREATE INDEX IF NOT EXISTS idx_vms_status      ON vms(status);
CREATE INDEX IF NOT EXISTS idx_vms_environment ON vms(environment);
CREATE INDEX IF NOT EXISTS idx_vms_expiry_date ON vms(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vms_ip_address  ON vms(ip_address);

PRAGMA foreign_keys = ON;
