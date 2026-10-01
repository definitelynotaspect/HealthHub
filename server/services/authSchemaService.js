export async function ensureAuthSchema(pool) {
  const [columns] = await pool.execute('SHOW COLUMNS FROM users')
  const columnNames = new Set(columns.map((column) => column.Field))

  const columnStatements = [
    ['token_version', 'ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0'],
    ['password_reset_token_hash', 'ALTER TABLE users ADD COLUMN password_reset_token_hash CHAR(64) NULL'],
    ['password_reset_expires_at', 'ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME NULL'],
    ['password_reset_used_at', 'ALTER TABLE users ADD COLUMN password_reset_used_at DATETIME NULL'],
  ]

  for (const [columnName, statement] of columnStatements) {
    if (!columnNames.has(columnName)) {
      await pool.execute(statement)
    }
  }

  const [indexes] = await pool.execute('SHOW INDEX FROM users WHERE Key_name = ?', [
    'users_password_reset_token_index',
  ])

  if (!indexes.length) {
    await pool.execute('ALTER TABLE users ADD INDEX users_password_reset_token_index (password_reset_token_hash)')
  }

  await pool.execute(
    "ALTER TABLE users MODIFY role ENUM('nurse', 'admin', 'clinic_admin') NOT NULL DEFAULT 'clinic_admin'"
  )
}
