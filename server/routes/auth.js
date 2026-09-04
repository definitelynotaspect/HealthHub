import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
  }
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email])
    const user = rows[0]

    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
      return res.status(401).json({ message: 'Incorrect email or password.' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.json({ token, user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, role FROM users WHERE id = ?',
      [req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ message: 'User not found.' })
    res.json({ user: publicUser(rows[0]) })
  } catch (error) {
    next(error)
  }
})

export default router
