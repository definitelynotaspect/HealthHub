ALTER TABLE patient_records
  ADD COLUMN email VARCHAR(191) NULL AFTER mother_occupation;

ALTER TABLE visits
  ADD COLUMN client_submission_key VARCHAR(191) NULL AFTER attending_physician,
  ADD COLUMN sent_home_email_sent_at DATETIME NULL AFTER client_submission_key,
  ADD COLUMN sent_home_email_error TEXT NULL AFTER sent_home_email_sent_at;

CREATE UNIQUE INDEX visits_client_submission_unique
  ON visits (client_submission_key);
