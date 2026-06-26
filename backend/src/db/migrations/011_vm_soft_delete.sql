-- Soft-delete support for VMs
ALTER TABLE vms ADD COLUMN deleted_at TEXT;
ALTER TABLE vms ADD COLUMN deleted_by INTEGER REFERENCES users(id);
ALTER TABLE vms ADD COLUMN delete_reason TEXT;
