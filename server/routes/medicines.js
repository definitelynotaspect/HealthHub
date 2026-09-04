import express from 'express'
import { pool } from '../db.js'
import { mapMedicine, toNullableString } from '../utils/format.js'

const router = express.Router()

async function getMedicineById(id) {
  const [rows] = await pool.execute('SELECT * FROM medicines WHERE id = ?', [id])
  return rows[0] ? mapMedicine(rows[0]) : null
}

router.get('/', async (req, res, next) => {
  try {
    const q = `%${String(req.query.q || '').trim()}%`
    const hasQuery = q !== '%%'
    const [rows] = await pool.execute(
      hasQuery
        ? 'SELECT * FROM medicines WHERE name LIKE ? OR category LIKE ? OR description LIKE ? ORDER BY name ASC'
        : 'SELECT * FROM medicines ORDER BY name ASC',
      hasQuery ? [q, q, q] : []
    )
    res.json({ data: rows.map(mapMedicine) })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const name = toNullableString(req.body.name)
    const quantity = Math.max(0, Number(req.body.quantity) || 0)
    if (!name) return res.status(400).json({ message: 'Medicine name is required.' })

    const [result] = await pool.execute(
      'INSERT INTO medicines (name, quantity, image, description, category) VALUES (?, ?, ?, ?, ?)',
      [
        name,
        quantity,
        toNullableString(req.body.image),
        toNullableString(req.body.description),
        toNullableString(req.body.category) || 'General medicine',
      ]
    )
    res.status(201).json({ data: await getMedicineById(result.insertId) })
  } catch (error) {
    next(error)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const name = toNullableString(req.body.name)
    const quantity = Math.max(0, Number(req.body.quantity) || 0)
    if (!name) return res.status(400).json({ message: 'Medicine name is required.' })

    const [result] = await pool.execute(
      'UPDATE medicines SET name = ?, quantity = ?, image = ?, description = ?, category = ? WHERE id = ?',
      [
        name,
        quantity,
        toNullableString(req.body.image),
        toNullableString(req.body.description),
        toNullableString(req.body.category) || 'General medicine',
        req.params.id,
      ]
    )
    if (!result.affectedRows) return res.status(404).json({ message: 'Medicine not found.' })
    res.json({ data: await getMedicineById(req.params.id) })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/adjust', async (req, res, next) => {
  try {
    const delta = Number(req.body.delta) || 0
    const [result] = await pool.execute(
      'UPDATE medicines SET quantity = GREATEST(0, quantity + ?) WHERE id = ?',
      [delta, req.params.id]
    )
    if (!result.affectedRows) return res.status(404).json({ message: 'Medicine not found.' })
    res.json({ data: await getMedicineById(req.params.id) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM medicines WHERE id = ?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ message: 'Medicine not found.' })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

export default router
