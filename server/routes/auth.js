import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { getJwtSecret, requireAuth } from '../middleware/auth.js'
import { logEmailError, sendPasswordResetEmail } from '../services/emailService.js'

const router = express.Router()
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12)
const RESET_TOKEN_MINUTES = Number(process.env.PASSWORD_RESET_MINUTES || 30)
const GENERIC_LOGIN_ERROR = 'Invalid email or password.'

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || row.fullName || 'Clinic Administrator',
    role: row.role,
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.'
  }
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.'
  return ''
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version || 0,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')

    if (!isValidEmail(email) || !password) {
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR })
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email])
    const user = rows[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR })
    }

    res.json({ token: createToken(user), user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

router.post('/logout', requireAuth, (req, res) => {
  res.status(204).send()
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ user: publicUser(req.user) })
  } catch (error) {
    next(error)
  }
})

router.put('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '')
    const newPassword = String(req.body?.newPassword || '')
    const confirmPassword = String(req.body?.confirmPassword || '')

    if (!currentPassword) return res.status(400).json({ message: 'Current password is required.' })
    if (newPassword !== confirmPassword) return res.status(400).json({ message: 'Confirm password must match.' })

    const policyError = validatePasswordPolicy(newPassword)
    if (policyError) return res.status(400).json({ message: policyError })

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id])
    const user = rows[0]
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ message: 'Current password is incorrect.' })
    }

    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ message: 'New password must be different from the current password.' })
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await pool.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [passwordHash, req.user.id]
    )

    res.json({ message: 'Password changed successfully. Please log in again.' })
  } catch (error) {
    next(error)
  }
})

router.put('/change-email', requireAuth, async (req, res, next) => {
  try {
    const newEmail = normalizeEmail(req.body?.newEmail)
    const currentPassword = String(req.body?.currentPassword || '')

    if (!isValidEmail(newEmail)) return res.status(400).json({ message: 'Enter a valid new email address.' })
    if (!currentPassword) return res.status(400).json({ message: 'Current password is required.' })
    if (newEmail === normalizeEmail(req.user.email)) {
      return res.status(400).json({ message: 'New email must be different from the current email.' })
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id])
    const user = rows[0]
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ message: 'Current password is incorrect.' })
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? AND id <> ?', [newEmail, req.user.id])
    if (existing[0]) return res.status(409).json({ message: 'That email address is already in use.' })

    await pool.execute(
      'UPDATE users SET email = ?, token_version = token_version + 1 WHERE id = ?',
      [newEmail, req.user.id]
    )

    res.json({ message: 'Email changed successfully. Please log in again using your new email.' })
  } catch (error) {
    next(error)
  }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const response = { message: 'If that email is registered, a password reset link has been sent.' }

    if (!isValidEmail(email)) return res.json(response)

    const [rows] = await pool.execute('SELECT id, email, full_name FROM users WHERE email = ?', [email])
    const user = rows[0]
    if (!user) return res.json(response)

    const resetToken = crypto.randomBytes(32).toString('hex')

    await pool.execute(
      `UPDATE users
       SET password_reset_token_hash = ?,
           password_reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
           password_reset_used_at = NULL
       WHERE id = ?`,
      [hashResetToken(resetToken), RESET_TOKEN_MINUTES, user.id]
    )

    try {
      await sendPasswordResetEmail({
        to: user.email,
        resetToken,
        expiresInMinutes: RESET_TOKEN_MINUTES,
        fullName: user.full_name,
      })
    } catch (error) {
      logEmailError('Unable to send password reset email.', error)
    }

    res.json(response)
  } catch (error) {
    next(error)
  }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const resetToken = String(req.body?.token || '')
    const newPassword = String(req.body?.newPassword || '')
    const confirmPassword = String(req.body?.confirmPassword || '')

    if (!resetToken) return res.status(400).json({ message: 'Password reset token is required.' })
    if (newPassword !== confirmPassword) return res.status(400).json({ message: 'Confirm password must match.' })

    const policyError = validatePasswordPolicy(newPassword)
    if (policyError) return res.status(400).json({ message: policyError })

    const [rows] = await pool.execute(
      `SELECT * FROM users
       WHERE password_reset_token_hash = ?
         AND password_reset_expires_at > NOW()
         AND password_reset_used_at IS NULL`,
      [hashResetToken(resetToken)]
    )
    const user = rows[0]
    if (!user) return res.status(400).json({ message: 'This password reset link is invalid or has expired.' })

    if (await bcrypt.compare(newPassword, user.password_hash)) {
      return res.status(400).json({ message: 'New password must be different from the current password.' })
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await pool.execute(
      `UPDATE users
       SET password_hash = ?,
           password_reset_used_at = NOW(),
           password_reset_token_hash = NULL,
           password_reset_expires_at = NULL,
           token_version = token_version + 1
       WHERE id = ?`,
      [passwordHash, user.id]
    )

    res.json({ message: 'Password reset successfully. Please log in.' })
  } catch (error) {
    next(error)
  }
})

export default router
