USE healthcare_clinic;

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