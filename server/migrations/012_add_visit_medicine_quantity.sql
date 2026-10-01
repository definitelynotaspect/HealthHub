USE healthcare_clinic;

ALTER TABLE visit_medicines
  ADD COLUMN IF NOT EXISTS quantity INT UNSIGNED NOT NULL DEFAULT 1 AFTER medicine_name;
