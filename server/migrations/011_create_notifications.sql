CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(191) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  related_id INT UNSIGNED NULL,
  related_type VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY notifications_user_created_index (user_id, created_at),
  KEY notifications_user_read_index (user_id, is_read),
  KEY notifications_type_index (type),
  KEY notifications_related_index (related_type, related_id),
  CONSTRAINT notifications_user_fk
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE SET NULL
);
