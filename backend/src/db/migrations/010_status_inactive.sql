PRAGMA foreign_keys = OFF;

-- Rename maintenance → inactive in vms (no CHECK constraint, just data)
UPDATE vms SET status = 'inactive' WHERE status = 'maintenance';

-- Rename maintenance → inactive in hypervisors data before recreating table
UPDATE hypervisors SET status = 'inactive' WHERE status = 'maintenance';

-- Recreate hypervisors with updated CHECK constraint (inactive replaces maintenance)
CREATE TABLE hypervisors_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  hostname    TEXT,
  type        TEXT CHECK(type IN ('VMware vSphere','Proxmox','Hyper-V','KVM','Other')),
  version     TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','inactive','decommissioned')),
  environment TEXT
    CHECK(environment IN ('production','staging','development','test')),
  vcpu        INTEGER,
  ram_gb      REAL,
  disk_gb     REAL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO hypervisors_new
  SELECT id, name, hostname, type, version, description,
         status, environment, vcpu, ram_gb, disk_gb, created_at, updated_at
  FROM hypervisors;

DROP TABLE hypervisors;
ALTER TABLE hypervisors_new RENAME TO hypervisors;

PRAGMA foreign_keys = ON;
