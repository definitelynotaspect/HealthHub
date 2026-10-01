import express from 'express'
import { pool } from '../db.js'
import { mapNotification } from '../services/notificationService.js'

const router = express.Router()

const FILTER_TYPES = {
  visits: ['NEW_CLINIC_VISIT', 'STUDENT_SENT_HOME', 'PARENT_NOTIFICATION_SENT', 'PARENT_NOTIFICATION_FAILED'],
  medicine: ['LOW_MEDICINE_STOCK', 'MEDICINE_OUT_OF_STOCK', 'MEDICINE_RESTOCKED'],
  system: ['HEALTH_RECORD_EXPORTED'],
}

function getLimit(value) {
  const limit = Number(value) || 50
  return Math.min(Math.max(limit, 1), 100)
}

router.get('/', async (req, res, next) => {
  try {
    const clauses = ['(user_id = ? OR user_id IS NULL)']
    const params = [req.user.id]

    if (req.query.status === 'unread') {
      clauses.push('is_read = 0')
    }

    const filter = String(req.query.filter || '').toLowerCase()
    if (FILTER_TYPES[filter]) {
      clauses.push(`type IN (${FILTER_TYPES[filter].map(() => '?').join(', ')})`)
      params.push(...FILTER_TYPES[filter])
    }

    const limit = getLimit(req.query.limit)
    const [rows] = await pool.query(
      `SELECT id, user_id, type, title, message, is_read, related_id, related_type, created_at, read_at
       FROM notifications
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [...params, limit]
    )

    res.json({ data: rows.map(mapNotification) })
  } catch (error) {
    next(error)
  }
})

router.get('/unread-count', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0',
      [req.user.id]
    )
    res.json({ count: Number(rows[0]?.count || 0) })
  } catch (error) {
    next(error)
  }
})

router.patch('/read-all', async (req, res, next) => {
  try {
    await pool.execute(
      `UPDATE notifications
       SET is_read = 1, read_at = COALESCE(read_at, NOW())
       WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0`,
      [req.user.id]
    )
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/read', async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      `UPDATE notifications
       SET is_read = 1, read_at = COALESCE(read_at, NOW())
       WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
      [req.params.id, req.user.id]
    )

    if (!result.affectedRows) return res.status(404).json({ message: 'Notification not found.' })

    const [rows] = await pool.execute(
      `SELECT id, user_id, type, title, message, is_read, related_id, related_type, created_at, read_at
       FROM notifications
       WHERE id = ?`,
      [req.params.id]
    )
    res.json({ data: mapNotification(rows[0]) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM notifications WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      [req.params.id, req.user.id]
    )

    if (!result.affectedRows) return res.status(404).json({ message: 'Notification not found.' })

    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

export default router
