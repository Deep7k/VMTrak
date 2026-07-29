-- Create hypervisors table
CREATE TABLE IF NOT EXISTS hypervisors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  hostname    TEXT,
  type        TEXT CHECK(type IN ('VMware vSphere','Proxmox','Hyper-V','KVM','Other')),
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed from existing distinct vms.hypervisor text values so no data is lost
INSERT OR IGNORE INTO hypervisors (name)
  SELECT DISTINCT hypervisor FROM vms
  WHERE hypervisor IS NOT NULL AND hypervisor != '';

-- Add FK column to vms (nullable — existing rows get NULL until backfill below)
ALTER TABLE vms ADD COLUMN hypervisor_id INTEGER REFERENCES hypervisors(id) ON DELETE SET NULL;

-- Backfill: link each VM to its newly created hypervisor row
UPDATE vms SET hypervisor_id = (
  SELECT id FROM hypervisors WHERE hypervisors.name = vms.hypervisor
) WHERE hypervisor IS NOT NULL AND hypervisor != '';
