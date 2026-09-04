USE healthcare_clinic;

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
