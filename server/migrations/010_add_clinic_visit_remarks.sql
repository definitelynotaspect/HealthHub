ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS clinic_visit_remarks TEXT NULL AFTER signs_symptoms;
