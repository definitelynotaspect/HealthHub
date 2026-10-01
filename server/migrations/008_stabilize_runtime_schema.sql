USE healthcare_clinic;

ALTER TABLE patient_records
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(191) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(191) NULL AFTER last_name,
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(191) NULL AFTER first_name,
  ADD COLUMN IF NOT EXISTS birthdate DATE NULL AFTER section,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(50) NULL AFTER birthdate,
  ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(191) NULL AFTER gender,
  ADD COLUMN IF NOT EXISTS father_name VARCHAR(191) NULL AFTER place_of_birth,
  ADD COLUMN IF NOT EXISTS father_occupation VARCHAR(191) NULL AFTER father_name,
  ADD COLUMN IF NOT EXISTS mother_name VARCHAR(191) NULL AFTER father_occupation,
  ADD COLUMN IF NOT EXISTS mother_occupation VARCHAR(191) NULL AFTER mother_name,
  ADD COLUMN IF NOT EXISTS email VARCHAR(191) NULL AFTER mother_occupation,
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(191) NULL AFTER address,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(80) NULL AFTER emergency_contact_name,
  ADD COLUMN IF NOT EXISTS emergency_contact_name_2 VARCHAR(191) NULL AFTER emergency_contact_phone,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone_2 VARCHAR(80) NULL AFTER emergency_contact_name_2,
  ADD COLUMN IF NOT EXISTS blood_type VARCHAR(20) NULL AFTER emergency_contact_phone_2,
  ADD COLUMN IF NOT EXISTS complete_immunization TINYINT(1) NULL AFTER blood_type,
  ADD COLUMN IF NOT EXISTS missed_immunization VARCHAR(255) NULL AFTER complete_immunization,
  ADD COLUMN IF NOT EXISTS medical_condition TINYINT(1) NULL AFTER missed_immunization,
  ADD COLUMN IF NOT EXISTS medical_condition_details VARCHAR(255) NULL AFTER medical_condition,
  ADD COLUMN IF NOT EXISTS hospitalized TINYINT(1) NULL AFTER medical_condition_details,
  ADD COLUMN IF NOT EXISTS hospitalization_details VARCHAR(255) NULL AFTER hospitalized,
  ADD COLUMN IF NOT EXISTS allergy TINYINT(1) NULL AFTER hospitalization_details,
  ADD COLUMN IF NOT EXISTS allergy_details VARCHAR(255) NULL AFTER allergy,
  ADD COLUMN IF NOT EXISTS covid_vaccination TINYINT(1) NULL AFTER allergy_details,
  ADD COLUMN IF NOT EXISTS covid_first_dose DATE NULL AFTER covid_vaccination,
  ADD COLUMN IF NOT EXISTS covid_second_dose DATE NULL AFTER covid_first_dose,
  ADD COLUMN IF NOT EXISTS covid_booster_1 DATE NULL AFTER covid_second_dose,
  ADD COLUMN IF NOT EXISTS covid_booster_2 DATE NULL AFTER covid_booster_1,
  ADD COLUMN IF NOT EXISTS health_conditions_json JSON NULL AFTER covid_booster_2,
  ADD COLUMN IF NOT EXISTS surgery TINYINT(1) NULL AFTER health_conditions_json,
  ADD COLUMN IF NOT EXISTS surgery_details VARCHAR(255) NULL AFTER surgery,
  ADD COLUMN IF NOT EXISTS maintenance_medication TINYINT(1) NULL AFTER surgery_details,
  ADD COLUMN IF NOT EXISTS maintenance_medications VARCHAR(255) NULL AFTER maintenance_medication,
  ADD COLUMN IF NOT EXISTS signature_name VARCHAR(191) NULL AFTER maintenance_medications;

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS temperature VARCHAR(40) NULL AFTER concern,
  ADD COLUMN IF NOT EXISTS height VARCHAR(40) NULL AFTER temperature,
  ADD COLUMN IF NOT EXISTS weight VARCHAR(40) NULL AFTER height,
  ADD COLUMN IF NOT EXISTS blood_pressure VARCHAR(40) NULL AFTER weight,
  ADD COLUMN IF NOT EXISTS respiratory_rate VARCHAR(40) NULL AFTER blood_pressure,
  ADD COLUMN IF NOT EXISTS pulse_rate VARCHAR(40) NULL AFTER respiratory_rate,
  ADD COLUMN IF NOT EXISTS oxygen_saturation VARCHAR(40) NULL AFTER pulse_rate,
  ADD COLUMN IF NOT EXISTS signs_symptoms TEXT NULL AFTER oxygen_saturation,
  ADD COLUMN IF NOT EXISTS visit_remarks TEXT NULL AFTER signs_symptoms,
  ADD COLUMN IF NOT EXISTS medication_first_aid TEXT NULL AFTER visit_remarks,
  ADD COLUMN IF NOT EXISTS medication_remarks TEXT NULL AFTER medication_first_aid,
  ADD COLUMN IF NOT EXISTS sent_home TINYINT(1) NOT NULL DEFAULT 0 AFTER discharged_at,
  ADD COLUMN IF NOT EXISTS sent_home_date DATE NULL AFTER sent_home,
  ADD COLUMN IF NOT EXISTS sent_home_time TIME NULL AFTER sent_home_date,
  ADD COLUMN IF NOT EXISTS attending_physician VARCHAR(191) NULL AFTER sent_home_time,
  ADD COLUMN IF NOT EXISTS client_submission_key VARCHAR(191) NULL AFTER attending_physician,
  ADD COLUMN IF NOT EXISTS sent_home_email_sent_at DATETIME NULL AFTER client_submission_key,
  ADD COLUMN IF NOT EXISTS sent_home_email_error TEXT NULL AFTER sent_home_email_sent_at;

CREATE UNIQUE INDEX IF NOT EXISTS visits_client_submission_unique
  ON visits (client_submission_key);

CREATE TABLE IF NOT EXISTS medicine_transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  medicine_id INT UNSIGNED NULL,
  medicine_name VARCHAR(191) NOT NULL,
  action VARCHAR(40) NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY medicine_transactions_medicine_index (medicine_id),
  KEY medicine_transactions_created_index (created_at),
  CONSTRAINT medicine_transactions_medicine_fk
    FOREIGN KEY (medicine_id)
    REFERENCES medicines (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS nurse_gallery_photos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nurse_profile_id INT UNSIGNED NOT NULL,
  image LONGTEXT NOT NULL,
  caption VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY nurse_gallery_profile_index (nurse_profile_id),
  CONSTRAINT nurse_gallery_profile_fk
    FOREIGN KEY (nurse_profile_id)
    REFERENCES nurse_profiles (id)
    ON DELETE CASCADE
);
