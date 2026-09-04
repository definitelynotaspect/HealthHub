import cors from 'cors'
import express from 'express'
import { pool } from './db.js'
import { requireAuth } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import medicineRoutes from './routes/medicines.js'
import nurseProfileRoutes from './routes/nurseProfile.js'
import patientRecordRoutes from './routes/patientRecords.js'
import visitRoutes from './routes/visits.js'

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, database: 'connected' })
  } catch (error) {
    next(error)
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/dashboard', requireAuth, dashboardRoutes)
app.use('/api/patient-records', requireAuth, patientRecordRoutes)
app.use('/api/patients', requireAuth, patientRecordRoutes)
app.use('/api/visits', requireAuth, visitRoutes)
app.use('/api/medicines', requireAuth, medicineRoutes)
app.use('/api/nurse-profile', requireAuth, nurseProfileRoutes)

app.use((req, res) => {
  res.status(404).json({ message: 'API route not found.' })
})

app.use((error, req, res, next) => {
  void next

  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A record with that unique value already exists.',
      errors: [],
    })
  }

  if (error?.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message || 'Request failed.',
      errors: [],
    })
  }

  console.error(error)
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server.',
    errors: [],
  })
})

app.listen(port, () => {
  console.log(`Clinic API running at http://localhost:${port}`)
})
