USE healthcare_clinic;

ALTER TABLE medicines
  ADD COLUMN IF NOT EXISTS category VARCHAR(120) NOT NULL DEFAULT 'General medicine'
  AFTER description;
