import jwt from 'jsonwebtoken'
import { pool } from '../db.js'

function getJwtSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-secret') {
    throw Object.assign(new Error('JWT_SECRET is not configured.'), { statusCode: 500 })
  }

  return process.env.JWT_SECRET
}

export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' })
  }

  try {
    const payload = jwt.verify(token, getJwtSecret())
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, role, token_version FROM users WHERE id = ?',
      [payload.id]
    )
    const user = rows[0]

    if (!user || Number(user.token_version || 0) !== Number(payload.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Invalid or expired token.' })
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      tokenVersion: user.token_version || 0,
    }
    next()
  } catch (error) {
    if (error.statusCode) return next(error)
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

export { getJwtSecret }
