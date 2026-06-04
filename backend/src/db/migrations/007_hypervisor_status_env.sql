ALTER TABLE hypervisors ADD COLUMN status      TEXT NOT NULL DEFAULT 'active'
  CHECK(status IN ('active','maintenance','decommissioned'));

ALTER TABLE hypervisors ADD COLUMN environment TEXT
  CHECK(environment IN ('production','staging','development','test'));
