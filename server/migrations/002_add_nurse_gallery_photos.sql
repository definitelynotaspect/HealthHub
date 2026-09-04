USE healthcare_clinic;

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
