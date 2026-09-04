import express from 'express'
import { pool } from '../db.js'

const router = express.Router()

router.get('/stats', async (req, res, next) => {
  try {
    const [[visitStats], [patientStats], [concerns], [medicineStats]] = await Promise.all([
      pool.execute(
        `SELECT
           COUNT(*) AS totalVisits,
           SUM(discharged_at IS NULL) AS activeVisits,
           SUM(discharged_at IS NOT NULL) AS dischargedVisits
         FROM visits`
      ),
      pool.execute('SELECT COUNT(*) AS totalPatients, COUNT(DISTINCT course) AS totalCourses FROM patient_records'),
      pool.execute(
        `SELECT concern AS label, COUNT(*) AS value
         FROM visits
         GROUP BY concern
         ORDER BY value DESC
         LIMIT 5`
      ),
      pool.execute(
        `SELECT
           COUNT(*) AS totalMedicines,
           COALESCE(SUM(quantity), 0) AS totalUnits,
           SUM(quantity <= 0) AS outOfStock,
           SUM(quantity > 0 AND quantity <= 5) AS lowStock
         FROM medicines`
      ),
    ])

    res.json({
      data: {
        visits: {
          total: Number(visitStats[0].totalVisits) || 0,
          active: Number(visitStats[0].activeVisits) || 0,
          discharged: Number(visitStats[0].dischargedVisits) || 0,
        },
        patients: {
          total: Number(patientStats[0].totalPatients) || 0,
          courses: Number(patientStats[0].totalCourses) || 0,
        },
        concerns: concerns.map((row) => ({
          label: row.label || 'General check-up',
          value: Number(row.value) || 0,
        })),
        medicines: {
          total: Number(medicineStats[0].totalMedicines) || 0,
          totalUnits: Number(medicineStats[0].totalUnits) || 0,
          outOfStock: Number(medicineStats[0].outOfStock) || 0,
          lowStock: Number(medicineStats[0].lowStock) || 0,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
