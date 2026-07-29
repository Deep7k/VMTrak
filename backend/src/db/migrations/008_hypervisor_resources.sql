ALTER TABLE hypervisors ADD COLUMN version TEXT;
ALTER TABLE hypervisors ADD COLUMN vcpu    INTEGER;
ALTER TABLE hypervisors ADD COLUMN ram_gb  REAL;
ALTER TABLE hypervisors ADD COLUMN disk_gb REAL;
