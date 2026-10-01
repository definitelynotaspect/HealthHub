ALTER TABLE users
  MODIFY role ENUM('nurse', 'admin', 'clinic_admin') NOT NULL DEFAULT 'clinic_admin',
  ADD COLUMN IF NOT EXISTS token_version INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_reset_token_hash CHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS password_reset_used_at DATETIME NULL,
  ADD INDEX IF NOT EXISTS users_password_reset_token_index (password_reset_token_hash);

UPDATE users
SET role = 'clinic_admin'
WHERE role IN ('nurse', 'admin');
