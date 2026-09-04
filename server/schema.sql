CREATE DATABASE IF NOT EXISTS healthcare_clinic
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE healthcare_clinic;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(191) NOT NULL,
  role ENUM('nurse', 'admin') NOT NULL DEFAULT 'nurse',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
);

CREATE TABLE IF NOT EXISTS patient_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(80) NULL,
  employee_id VARCHAR(80) NULL,
  name VARCHAR(191) NOT NULL,
  position VARCHAR(50) NOT NULL DEFAULT 'Student',
  department VARCHAR(191) NULL,
  course VARCHAR(80) NULL,
  year_level VARCHAR(50) NULL,
  section VARCHAR(80) NULL,
  birthdate DATE NULL,
  gender VARCHAR(50) NULL,
  place_of_birth VARCHAR(191) NULL,
  father_name VARCHAR(191) NULL,
  father_occupation VARCHAR(191) NULL,
  mother_name VARCHAR(191) NULL,
  mother_occupation VARCHAR(191) NULL,
  contact VARCHAR(80) NULL,
  address VARCHAR(255) NULL,
  emergency_contact_name VARCHAR(191) NULL,
  emergency_contact_phone VARCHAR(80) NULL,
  emergency_contact_name_2 VARCHAR(191) NULL,
  emergency_contact_phone_2 VARCHAR(80) NULL,
  blood_type VARCHAR(20) NULL,
  complete_immunization TINYINT(1) NULL,
  missed_immunization VARCHAR(255) NULL,
  medical_condition TINYINT(1) NULL,
  medical_condition_details VARCHAR(255) NULL,
  hospitalized TINYINT(1) NULL,
  hospitalization_details VARCHAR(255) NULL,
  allergy TINYINT(1) NULL,
  allergy_details VARCHAR(255) NULL,
  covid_vaccination TINYINT(1) NULL,
  covid_first_dose DATE NULL,
  covid_second_dose DATE NULL,
  covid_booster_1 DATE NULL,
  covid_booster_2 DATE NULL,
  health_conditions_json JSON NULL,
  surgery TINYINT(1) NULL,
  surgery_details VARCHAR(255) NULL,
  maintenance_medication TINYINT(1) NULL,
  maintenance_medications VARCHAR(255) NULL,
  signature_name VARCHAR(191) NULL,
  registered_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY patient_student_id_unique (student_id),
  UNIQUE KEY patient_employee_id_unique (employee_id),
  KEY patient_name_index (name),
  KEY patient_course_index (course)
);

CREATE TABLE IF NOT EXISTS medicines (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(191) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  image LONGTEXT NULL,
  description TEXT NULL,
  category VARCHAR(120) NOT NULL DEFAULT 'General medicine',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY medicines_name_unique (name)
);

CREATE TABLE IF NOT EXISTS visits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_record_id INT UNSIGNED NULL,
  name VARCHAR(191) NOT NULL,
  position VARCHAR(50) NOT NULL DEFAULT 'Student',
  department VARCHAR(191) NULL,
  student_id VARCHAR(80) NULL,
  employee_id VARCHAR(80) NULL,
  course VARCHAR(80) NULL,
  year_level VARCHAR(50) NULL,
  section VARCHAR(80) NULL,
  concern VARCHAR(191) NOT NULL DEFAULT 'General check-up',
  temperature VARCHAR(40) NULL,
  height VARCHAR(40) NULL,
  weight VARCHAR(40) NULL,
  blood_pressure VARCHAR(40) NULL,
  respiratory_rate VARCHAR(40) NULL,
  pulse_rate VARCHAR(40) NULL,
  oxygen_saturation VARCHAR(40) NULL,
  signs_symptoms TEXT NULL,
  visit_remarks TEXT NULL,
  medication_first_aid TEXT NULL,
  medication_remarks TEXT NULL,
  visit_datetime DATETIME NOT NULL,
  discharged_at DATETIME NULL,
  sent_home TINYINT(1) NOT NULL DEFAULT 0,
  sent_home_date DATE NULL,
  sent_home_time TIME NULL,
  attending_physician VARCHAR(191) NULL,
  timestamp BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY visits_patient_record_index (patient_record_id),
  KEY visits_concern_index (concern),
  KEY visits_datetime_index (visit_datetime),
  CONSTRAINT visits_patient_record_fk
    FOREIGN KEY (patient_record_id)
    REFERENCES patient_records (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visit_medicines (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  visit_id INT UNSIGNED NOT NULL,
  medicine_id INT UNSIGNED NULL,
  medicine_name VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY visit_medicines_visit_index (visit_id),
  KEY visit_medicines_medicine_index (medicine_id),
  CONSTRAINT visit_medicines_visit_fk
    FOREIGN KEY (visit_id)
    REFERENCES visits (id)
    ON DELETE CASCADE,
  CONSTRAINT visit_medicines_medicine_fk
    FOREIGN KEY (medicine_id)
    REFERENCES medicines (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS nurse_profiles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  full_name VARCHAR(191) NOT NULL,
  role VARCHAR(80) NOT NULL,
  email VARCHAR(191) NOT NULL,
  contact VARCHAR(80) NULL,
  employee_id VARCHAR(80) NULL,
  shift VARCHAR(80) NULL,
  department VARCHAR(191) NULL,
  assigned_room VARCHAR(191) NULL,
  license VARCHAR(80) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'On duty',
  duties_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY nurse_profiles_user_index (user_id),
  CONSTRAINT nurse_profiles_user_fk
    FOREIGN KEY (user_id)
    REFERENCES users (id)
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

CREATE TABLE IF NOT EXISTS import_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  resource VARCHAR(80) NOT NULL,
  file_name VARCHAR(255) NULL,
  total_records INT UNSIGNED NOT NULL DEFAULT 0,
  imported_records INT UNSIGNED NOT NULL DEFAULT 0,
  failed_records INT UNSIGNED NOT NULL DEFAULT 0,
  duplicate_records INT UNSIGNED NOT NULL DEFAULT 0,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY import_history_user_index (user_id),
  KEY import_history_resource_index (resource),
  CONSTRAINT import_history_user_fk
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE SET NULL
);

INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'interworldcolleges@clinic.com',
  '$2a$10$v1TkMiLzGA0lfxOXQPvA3.IIR0B2ku6lNGcYlB4hgCcwDmSSAgHn2',
  'Curt Cuvin Gamurot',
  'nurse'
)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  role = VALUES(role);

INSERT INTO nurse_profiles
  (user_id, full_name, role, email, contact, employee_id, shift, department, assigned_room, license, status, duties_json)
SELECT
  u.id,
  'Curt Cuvin Gamurot',
  'Clinic Nurse',
  'curtcuvingamurot0@gmail.com',
  '0951 058 9402',
  '2026-0630',
  '8:00 AM - 5:00 PM',
  'School Clinic Department',
  'Main Clinic Room',
  'RN-1087510',
  'On duty',
  JSON_ARRAY(
    'Record student clinic visits and common concerns.',
    'Monitor active cases until students are timed out.',
    'Maintain accurate student health visit history.',
    'Provide basic first aid and immediate health assistance.',
    'Monitor students recovering inside the clinic.',
    'Coordinate referrals and follow-up care when needed.'
  )
FROM users u
WHERE u.email = 'interworldcolleges@clinic.com'
  AND NOT EXISTS (SELECT 1 FROM nurse_profiles);

INSERT INTO medicines (name, quantity, description, category) VALUES
  ('Neozep', 0, 'Commonly used for cold symptoms such as stuffy nose, runny nose, sneezing, headache, and fever.', 'Colds and fever'),
  ('Alaxan', 0, 'Commonly used for body pain, headache, muscle aches, toothache, and fever.', 'Fever and pain relief'),
  ('Biogesic (Paracetamol)', 0, 'Paracetamol/acetaminophen is commonly used to reduce fever and relieve mild to moderate pain.', 'Fever and pain relief'),
  ('Medicol or Advil (Ibuprofen)', 0, 'Ibuprofen is commonly used for pain, fever, and inflammation such as muscle aches or menstrual cramps.', 'Fever and pain relief'),
  ('Dolfenal or Ponstan (Mefenamic Acid)', 0, 'Mefenamic acid is commonly used for short-term pain relief, including menstrual cramps and other mild to moderate pain.', 'Fever and pain relief'),
  ('Alnix or Zyrtec (Cetirizine)', 0, 'Cetirizine is commonly used for allergy symptoms such as sneezing, runny nose, itchy eyes, and hives.', 'Allergy relief'),
  ('Claritin (Loratadine)', 0, 'Loratadine is commonly used for allergy symptoms such as sneezing, runny nose, itchy or watery eyes, and itching.', 'Allergy relief'),
  ('Benadryl', 0, 'Diphenhydramine is commonly used for allergy symptoms and itching, and may cause drowsiness.', 'Allergy relief'),
  ('Bioflu', 0, 'Commonly used for flu-like symptoms such as fever, headache, body aches, colds, and nasal congestion.', 'Colds and fever'),
  ('Kremil-S', 0, 'Commonly used for hyperacidity, heartburn, indigestion, and gas discomfort.', 'Digestive relief'),
  ('Betadine', 0, 'Commonly used as an antiseptic for cleaning minor wounds and helping reduce germs on the skin.', 'First aid and antiseptic'),
  ('Green Cross Alcohol', 0, 'Commonly used as a disinfectant for skin and surfaces, following product directions.', 'First aid and antiseptic')
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  category = VALUES(category);
