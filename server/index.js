import cors from 'cors'
import express from 'express'
import { pool } from './db.js'
import { requireAuth } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import medicineRoutes from './routes/medicines.js'
import { ensureAuthSchema } from './services/authSchemaService.js'
import { ensureMedicineTransactionSchema } from './services/medicineTransactionService.js'
import { ensureNotificationSchema } from './services/notificationService.js'
import { ensurePatientImportSchema } from './services/patientImportService.js'
import nurseProfileRoutes from './routes/nurseProfile.js'
import { ensureGalleryTable } from './routes/nurseProfile.js'
import notificationRoutes from './routes/notifications.js'
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
    if (isDatabaseConnectionError(error)) {
      res.status(503).json({
        ok: false,
        database: 'disconnected',
        message: 'MySQL is not available. Please start MySQL in XAMPP and try again.',
      })
      return
    }

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
app.use('/api/notifications', requireAuth, notificationRoutes)

app.use((req, res) => {
  res.status(404).json({ message: 'API route not found.' })
})

function isDatabaseConnectionError(error) {
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
    'ER_CON_COUNT_ERROR',
    'POOL_CONNLIMIT',
    'POOL_ENQUEUELIMIT',
  ].includes(error?.code)
}

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

  if (isDatabaseConnectionError(error)) {
    console.error('MySQL connection error:', {
      code: error.code,
      message: error.message,
    })

    return res.status(503).json({
      success: false,
      message: 'MySQL is not available right now. Please check XAMPP MySQL and try again.',
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

async function initializeDatabaseSchema() {
  await ensureAuthSchema(pool)
  await ensurePatientImportSchema()
  await ensureMedicineTransactionSchema(pool)
  await ensureNotificationSchema(pool)
  await ensureGalleryTable()
}

initializeDatabaseSchema()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Clinic API running at http://localhost:${port}`)
    })

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing API process or set a different PORT in server/.env.`)
      } else {
        console.error('Failed to start the Clinic API.', error)
      }

      process.exitCode = 1
    })
  })
  .catch((error) => {
    console.error('Failed to initialize the MySQL schema. Start MySQL in XAMPP and run the SQL migrations before starting the API.', error)
    process.exitCode = 1
  })
