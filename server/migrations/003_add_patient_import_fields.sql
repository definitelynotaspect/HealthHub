USE healthcare_clinic;

ALTER TABLE patient_records
  ADD COLUMN birthdate DATE NULL AFTER section,
  ADD COLUMN gender VARCHAR(50) NULL AFTER birthdate;
