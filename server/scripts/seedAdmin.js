import bcrypt from 'bcryptjs'
import { pool } from '../db.js'

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = String(process.env.ADMIN_PASSWORD || '')
const fullName = String(process.env.ADMIN_FULL_NAME || 'Clinic Administrator').trim()
const role = 'clinic_admin'
const rounds = Number(process.env.BCRYPT_ROUNDS || 12)

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validatePassword(value) {
  if (value.length < 8) return 'ADMIN_PASSWORD must be at least 8 characters.'
  if (!/[A-Z]/.test(value)) return 'ADMIN_PASSWORD must include at least one uppercase letter.'
  if (!/[a-z]/.test(value)) return 'ADMIN_PASSWORD must include at least one lowercase letter.'
  if (!/[0-9]/.test(value)) return 'ADMIN_PASSWORD must include at least one number.'
  return ''
}

async function seedAdmin() {
  if (!isValidEmail(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.')
  }

  const passwordError = validatePassword(password)
  if (passwordError) throw new Error(passwordError)

  const passwordHash = await bcrypt.hash(password, rounds)

  await pool.execute(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       full_name = VALUES(full_name),
       role = VALUES(role),
       token_version = token_version + 1,
       password_reset_token_hash = NULL,
       password_reset_expires_at = NULL,
       password_reset_used_at = NULL`,
    [email, passwordHash, fullName || 'Clinic Administrator', role]
  )

  console.log(`Clinic admin account is ready for ${email}.`)
}

seedAdmin()
  .catch((error) => {
    console.error(error.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
