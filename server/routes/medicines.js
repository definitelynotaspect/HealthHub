import express from 'express'
import { pool, transaction } from '../db.js'
import { mapMedicine, toNullableString } from '../utils/format.js'
import { recordMedicineTransaction } from '../services/medicineTransactionService.js'
import { createMedicineStockNotifications } from '../services/notificationService.js'

const router = express.Router()

async function getMedicineById(id, connection = pool) {
  const [rows] = await connection.execute('SELECT * FROM medicines WHERE id = ?', [id])
  return rows[0] ? mapMedicine(rows[0]) : null
}

const medicineListFields = `
  id,
  name,
  quantity,
  image,
  description,
  category,
  created_at,
  updated_at,
  image IS NOT NULL AND image <> '' AS has_image
`

router.get('/transactions', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, medicine_id, medicine_name, action, quantity, created_at
       FROM medicine_transactions
       ORDER BY created_at DESC, id DESC
       LIMIT 200`
    )
    res.json({ data: rows })
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      res.json({ data: [] })
      return
    }

    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const q = `%${String(req.query.q || '').trim()}%`
    const hasQuery = q !== '%%'
    const [rows] = await pool.execute(
      hasQuery
        ? `SELECT ${medicineListFields} FROM medicines WHERE name LIKE ? OR category LIKE ? OR description LIKE ? ORDER BY name ASC`
        : `SELECT ${medicineListFields} FROM medicines ORDER BY name ASC`,
      hasQuery ? [q, q, q] : []
    )
    res.json({ data: rows.map(mapMedicine) })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const medicine = await getMedicineById(req.params.id)
    if (!medicine) return res.status(404).json({ message: 'Medicine not found.' })
    res.json({ data: medicine })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const name = toNullableString(req.body.name)
    const quantity = Math.max(0, Number(req.body.quantity) || 0)
    if (!name) return res.status(400).json({ message: 'Medicine name is required.' })

    const medicine = await transaction(async (connection) => {
      const [result] = await connection.execute(
        'INSERT INTO medicines (name, quantity, image, description, category) VALUES (?, ?, ?, ?, ?)',
        [
          name,
          quantity,
          toNullableString(req.body.image),
          toNullableString(req.body.description),
          toNullableString(req.body.category) || 'General medicine',
        ]
      )
      const createdMedicine = await getMedicineById(result.insertId, connection)
      await recordMedicineTransaction(connection, createdMedicine, quantity)
      await createMedicineStockNotifications(connection, {
        medicine: createdMedicine,
        previousQuantity: 0,
        nextQuantity: createdMedicine.quantity,
        changeQuantity: createdMedicine.quantity,
        userId: req.user.id,
      })
      return createdMedicine
    })
    res.status(201).json({ data: medicine })
  } catch (error) {
    next(error)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const name = toNullableString(req.body.name)
    const quantity = Math.max(0, Number(req.body.quantity) || 0)
    if (!name) return res.status(400).json({ message: 'Medicine name is required.' })

    const medicine = await transaction(async (connection) => {
      const existingMedicine = await getMedicineById(req.params.id, connection)
      if (!existingMedicine) return null

      await connection.execute(
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
      const updatedMedicine = await getMedicineById(req.params.id, connection)
      const changeQuantity = quantity - existingMedicine.quantity
      await recordMedicineTransaction(connection, updatedMedicine, changeQuantity)
      await createMedicineStockNotifications(connection, {
        medicine: updatedMedicine,
        previousQuantity: existingMedicine.quantity,
        nextQuantity: updatedMedicine.quantity,
        changeQuantity,
        userId: req.user.id,
      })
      return updatedMedicine
    })
    if (!medicine) return res.status(404).json({ message: 'Medicine not found.' })
    res.json({ data: medicine })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/adjust', async (req, res, next) => {
  try {
    const delta = Number(req.body.delta) || 0
    const medicine = await transaction(async (connection) => {
      const existingMedicine = await getMedicineById(req.params.id, connection)
      if (!existingMedicine) return null

      const nextQuantity = Math.max(0, existingMedicine.quantity + delta)
      await connection.execute(
        'UPDATE medicines SET quantity = ? WHERE id = ?',
        [nextQuantity, req.params.id]
      )
      const updatedMedicine = await getMedicineById(req.params.id, connection)
      const changeQuantity = nextQuantity - existingMedicine.quantity
      await recordMedicineTransaction(connection, updatedMedicine, changeQuantity)
      await createMedicineStockNotifications(connection, {
        medicine: updatedMedicine,
        previousQuantity: existingMedicine.quantity,
        nextQuantity: updatedMedicine.quantity,
        changeQuantity,
        userId: req.user.id,
      })
      return updatedMedicine
    })
    if (!medicine) return res.status(404).json({ message: 'Medicine not found.' })
    res.json({ data: medicine })
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
