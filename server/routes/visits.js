import express from 'express'
import { pool, transaction } from '../db.js'
import { mapVisit, normalizeDepartment, toMysqlDate, toMysqlDateTime, toNullableString } from '../utils/format.js'
import { ensurePatientImportSchema } from '../services/patientImportService.js'
import { ensureMedicineTransactionSchema, recordMedicineTransaction } from '../services/medicineTransactionService.js'
import { logEmailError, sendSentHomeEmail } from '../services/emailService.js'
import {
  createMedicineStockNotifications,
  createParentEmailNotification,
  createSentHomeNotification,
  createVisitNotification,
} from '../services/notificationService.js'

const router = express.Router()

function isStudent(position) {
  return !position || position === 'Student'
}

function toNullableBoolean(value) {
  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  const normalized = String(value).trim().toLowerCase()
  if (['yes', 'true', '1'].includes(normalized)) return 1
  if (['no', 'false', '0'].includes(normalized)) return 0
  return null
}

function getSentHomeDischargedAt({ dischargedAt, sentHome, sentHomeDate, sentHomeTime }, now) {
  if (!sentHome) return dischargedAt
  if (dischargedAt) return dischargedAt

  if (sentHomeDate && sentHomeTime) {
    return toMysqlDateTime(`${sentHomeDate}T${sentHomeTime}`) || toMysqlDateTime(now)
  }

  return toMysqlDateTime(now)
}

function visitPayload(body) {
  const position = body.position || 'Student'
  const student = isStudent(position)
  const now = new Date()
  const sentHome = body.sentHome ? 1 : 0
  const sentHomeDate = toMysqlDate(body.sentHomeDate)
  const sentHomeTime = toNullableString(body.sentHomeTime)
  const dischargedAt = toMysqlDateTime(body.dischargedAt)

  return {
    patientRecordId: body.patientRecordId || null,
    name: toNullableString(body.name),
    lastName: toNullableString(body.lastName),
    firstName: toNullableString(body.firstName),
    middleName: toNullableString(body.middleName),
    position,
    department: toNullableString(normalizeDepartment(body.department, student ? body.course : '')),
    studentId: student ? toNullableString(body.studentId) : null,
    employeeId: student ? null : toNullableString(body.employeeId),
    course: student ? toNullableString(body.course) : null,
    yearLevel: student ? toNullableString(body.yearLevel) : null,
    section: student ? toNullableString(body.section) : null,
    concern: toNullableString(body.signsSymptoms) || toNullableString(body.concern) || 'General check-up',
    temperature: toNullableString(body.temperature),
    height: toNullableString(body.height),
    weight: toNullableString(body.weight),
    bloodPressure: toNullableString(body.bloodPressure),
    respiratoryRate: toNullableString(body.respiratoryRate),
    pulseRate: toNullableString(body.pulseRate),
    oxygenSaturation: toNullableString(body.oxygenSaturation),
    signsSymptoms: toNullableString(body.signsSymptoms),
    clinicVisitRemarks: toNullableString(body.clinicVisitRemarks),
    visitRemarks: toNullableString(body.visitRemarks),
    medicationFirstAid: toNullableString(body.medicationFirstAid),
    medicationRemarks: toNullableString(body.medicationRemarks),
    medicines: normalizeMedicinePayload(body.medicines),
    visitDateTime: toMysqlDateTime(body.visitDateTime) || toMysqlDateTime(now),
    dischargedAt: getSentHomeDischargedAt({ dischargedAt, sentHome, sentHomeDate, sentHomeTime }, now),
    sentHome,
    sentHomeDate,
    sentHomeTime,
    attendingPhysician: toNullableString(body.attendingPhysician),
    timestamp: body.timestamp || now.getTime(),
    email: toNullableString(body.email),
    contact: toNullableString(body.contact),
    address: toNullableString(body.address),
    birthdate: toMysqlDate(body.birthdate),
    gender: toNullableString(body.gender),
    placeOfBirth: toNullableString(body.placeOfBirth),
    fatherName: toNullableString(body.fatherName),
    fatherOccupation: toNullableString(body.fatherOccupation),
    motherName: toNullableString(body.motherName),
    motherOccupation: toNullableString(body.motherOccupation),
    emergencyContactName: toNullableString(body.emergencyContactName),
    emergencyContactPhone: toNullableString(body.emergencyContactPhone),
    emergencyContactName2: toNullableString(body.emergencyContactName2),
    emergencyContactPhone2: toNullableString(body.emergencyContactPhone2),
    bloodType: toNullableString(body.bloodType),
    completeImmunization: toNullableBoolean(body.completeImmunization),
    missedImmunization: toNullableString(body.missedImmunization),
    medicalCondition: toNullableBoolean(body.medicalCondition),
    medicalConditionDetails: toNullableString(body.medicalConditionDetails),
    hospitalized: toNullableBoolean(body.hospitalized),
    hospitalizationDetails: toNullableString(body.hospitalizationDetails),
    allergy: toNullableBoolean(body.allergy),
    allergyDetails: toNullableString(body.allergyDetails),
    covidVaccination: toNullableBoolean(body.covidVaccination),
    covidFirstDose: toMysqlDate(body.covidFirstDose),
    covidSecondDose: toMysqlDate(body.covidSecondDose),
    covidBooster1: toMysqlDate(body.covidBooster1),
    covidBooster2: toMysqlDate(body.covidBooster2),
    healthConditions: JSON.stringify(Array.isArray(body.healthConditions) ? body.healthConditions.filter(Boolean) : []),
    surgery: toNullableBoolean(body.surgery),
    surgeryDetails: toNullableString(body.surgeryDetails),
    maintenanceMedication: toNullableBoolean(body.maintenanceMedication),
    maintenanceMedications: toNullableString(body.maintenanceMedications),
    signatureName: toNullableString(body.signatureName),
  }
}

function normalizeMedicinePayload(medicines) {
  if (!Array.isArray(medicines)) return []

  const selections = new Map()
  medicines
    .map((item) => {
      if (typeof item === 'string') {
        const parsed = parseMedicineString(item)
        return parsed.name ? parsed : null
      }

      const name = toNullableString(item?.name)
      const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1))
      return name ? { name, quantity } : null
    })
    .filter(Boolean)
    .forEach((item) => {
      const key = item.name.toLowerCase()
      const current = selections.get(key)
      selections.set(key, {
        name: current?.name || item.name,
        quantity: (current?.quantity || 0) + item.quantity,
      })
    })

  return Array.from(selections.values())
}

function parseMedicineString(value) {
  const text = toNullableString(value) || ''
  const compactMatch = text.match(/^(.*?)::(\d+)$/)
  const trailingMatch = text.match(/^(.*?)\s+x\s*(\d+)$/i)
  const leadingMatch = text.match(/^(\d+)\s+(.+)$/)

  if (compactMatch) {
    return {
      name: compactMatch[1].trim(),
      quantity: Math.max(1, Math.floor(Number(compactMatch[2]) || 1)),
    }
  }

  if (trailingMatch) {
    return {
      name: trailingMatch[1].trim(),
      quantity: Math.max(1, Math.floor(Number(trailingMatch[2]) || 1)),
    }
  }

  if (leadingMatch) {
    return {
      name: leadingMatch[2].trim(),
      quantity: Math.max(1, Math.floor(Number(leadingMatch[1]) || 1)),
    }
  }

  return { name: text, quantity: 1 }
}

async function ensureVisitMedicineQuantityColumn(connection) {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'visit_medicines'
       AND COLUMN_NAME = 'quantity'`
  )

  if (!columns.length) {
    await connection.execute(
      'ALTER TABLE visit_medicines ADD COLUMN quantity INT UNSIGNED NOT NULL DEFAULT 1 AFTER medicine_name'
    )
  }
}

function isStudentVisit(visit) {
  return String(visit?.position || 'Student').trim().toLowerCase() === 'student'
}

function getSentHomePatientIdentifier(visit) {
  const hasStudentId = Boolean(visit?.studentId)
  const hasEmployeeId = Boolean(visit?.employeeId)
  const isStudent = isStudentVisit(visit)

  // Older imported records can carry a default "Student" position even when the
  // actual identifier is employee_id. Prefer the populated employee ID in that
  // case, while all explicitly non-student roles always use it.
  if (!isStudent || (hasEmployeeId && !hasStudentId)) {
    return { value: visit?.employeeId || '', label: 'Employee ID' }
  }

  if (hasStudentId) {
    return { value: visit.studentId, label: 'Student ID' }
  }

  return { value: visit?.employeeId || visit?.studentId || '', label: isStudent ? 'Student ID' : 'Employee ID' }
}

function getEmailErrorMessage(error) {
  return [error?.message, error?.code, error?.command, error?.responseCode]
    .filter(Boolean)
    .join(' | ')
    .slice(0, 1000)
}

async function getPatientNotificationDetails(patientRecordId) {
  if (!patientRecordId) return null
  const [rows] = await pool.execute(
    'SELECT email, position, student_id, employee_id FROM patient_records WHERE id = ? LIMIT 1',
    [patientRecordId]
  )
  const record = rows[0]
  if (!record) return null
  return {
    email: record.email || '',
    position: record.position || 'Student',
    studentId: record.student_id || '',
    employeeId: record.employee_id || '',
  }
}

async function sendSentHomeNotification(visit, payload) {
  if (!visit?.sentHome) return null
  if (visit.sentHomeEmailSentAt) return { status: 'already_sent' }
  if (visit.sentHomeEmailError) return { status: 'already_failed' }

  const patientDetails = await getPatientNotificationDetails(visit.patientRecordId)
  const to = payload.email || patientDetails?.email || ''
  if (!to) {
    await pool.execute(
      'UPDATE visits SET sent_home_email_error = ? WHERE id = ?',
      ['No patient email address is available.', visit.id]
    )
    return { status: 'missing_email' }
  }

  try {
    // The profile is the source of truth for a patient role and identifier.
    // This avoids an older visit snapshot incorrectly displaying Student ID
    // for an employee in the outbound email.
    const patientIdentifier = getSentHomePatientIdentifier(patientDetails || visit)
    await sendSentHomeEmail({
      to,
      patientName: visit.name,
      patientId: patientIdentifier.value,
      patientIdLabel: patientIdentifier.label,
      sentHomeDate: visit.sentHomeDate,
      sentHomeTime: visit.sentHomeTime,
    })
    await pool.execute(
      'UPDATE visits SET sent_home_email_sent_at = NOW(), sent_home_email_error = NULL WHERE id = ?',
      [visit.id]
    )
    return { status: 'sent' }
  } catch (error) {
    logEmailError('Unable to send sent-home email.', error)
    await pool.execute(
      'UPDATE visits SET sent_home_email_error = ? WHERE id = ?',
      [getEmailErrorMessage(error), visit.id]
    )
    return { status: 'failed' }
  }
}

function normalizeRecordValue(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function patientMatchesPayload(patient, payload) {
  const patientName = normalizeRecordValue(patient.name)
  const payloadName = normalizeRecordValue(payload.name)
  const patientPosition = normalizeRecordValue(patient.position || 'Student')
  const payloadPosition = normalizeRecordValue(payload.position || 'Student')

  if (patientName && payloadName && patientName !== payloadName) return false
  if (patientPosition && payloadPosition && patientPosition !== payloadPosition) return false
  return true
}

function createPatientConflictError(patient, recordId) {
  const error = new Error(
    `${recordId || 'This ID'} already belongs to ${patient.name}. Please use the correct patient or enter a unique ID.`
  )
  error.statusCode = 409
  return error
}

async function updatePatientRecordFromVisit(connection, patientRecordId, payload) {
  await connection.execute(
    `UPDATE patient_records
     SET name = ?, position = ?, department = ?, student_id = ?, employee_id = ?,
         last_name = COALESCE(?, last_name), first_name = COALESCE(?, first_name),
         middle_name = COALESCE(?, middle_name), course = ?, year_level = ?, section = ?, contact = COALESCE(?, contact),
         address = COALESCE(?, address), birthdate = COALESCE(?, birthdate),
         gender = COALESCE(?, gender), place_of_birth = COALESCE(?, place_of_birth),
         father_name = COALESCE(?, father_name), father_occupation = COALESCE(?, father_occupation),
         mother_name = COALESCE(?, mother_name), mother_occupation = COALESCE(?, mother_occupation),
         emergency_contact_name = COALESCE(?, emergency_contact_name),
         emergency_contact_phone = COALESCE(?, emergency_contact_phone),
         emergency_contact_name_2 = COALESCE(?, emergency_contact_name_2),
         emergency_contact_phone_2 = COALESCE(?, emergency_contact_phone_2),
         blood_type = COALESCE(?, blood_type), complete_immunization = COALESCE(?, complete_immunization),
         missed_immunization = COALESCE(?, missed_immunization),
         medical_condition = COALESCE(?, medical_condition),
         medical_condition_details = COALESCE(?, medical_condition_details),
         hospitalized = COALESCE(?, hospitalized), hospitalization_details = COALESCE(?, hospitalization_details),
         allergy = COALESCE(?, allergy), allergy_details = COALESCE(?, allergy_details),
         covid_vaccination = COALESCE(?, covid_vaccination),
         covid_first_dose = COALESCE(?, covid_first_dose),
         covid_second_dose = COALESCE(?, covid_second_dose),
         covid_booster_1 = COALESCE(?, covid_booster_1),
         covid_booster_2 = COALESCE(?, covid_booster_2),
         health_conditions_json = COALESCE(?, health_conditions_json),
         surgery = COALESCE(?, surgery), surgery_details = COALESCE(?, surgery_details),
         maintenance_medication = COALESCE(?, maintenance_medication),
         maintenance_medications = COALESCE(?, maintenance_medications),
         signature_name = COALESCE(?, signature_name)
     WHERE id = ?`,
    [
      payload.name,
      payload.position,
      payload.department,
      payload.studentId,
      payload.employeeId,
      payload.lastName,
      payload.firstName,
      payload.middleName,
      payload.course,
      payload.yearLevel,
      payload.section,
      payload.contact,
      payload.address,
      payload.birthdate,
      payload.gender,
      payload.placeOfBirth,
      payload.fatherName,
      payload.fatherOccupation,
      payload.motherName,
      payload.motherOccupation,
      payload.emergencyContactName,
      payload.emergencyContactPhone,
      payload.emergencyContactName2,
      payload.emergencyContactPhone2,
      payload.bloodType,
      payload.completeImmunization,
      payload.missedImmunization,
      payload.medicalCondition,
      payload.medicalConditionDetails,
      payload.hospitalized,
      payload.hospitalizationDetails,
      payload.allergy,
      payload.allergyDetails,
      payload.covidVaccination,
      payload.covidFirstDose,
      payload.covidSecondDose,
      payload.covidBooster1,
      payload.covidBooster2,
      payload.healthConditions,
      payload.surgery,
      payload.surgeryDetails,
      payload.maintenanceMedication,
      payload.maintenanceMedications,
      payload.signatureName,
      patientRecordId,
    ]
  )
}

async function findOrCreatePatient(connection, payload) {
  if (payload.patientRecordId) {
    const [rows] = await connection.execute('SELECT * FROM patient_records WHERE id = ?', [payload.patientRecordId])
    if (rows[0]) {
      if (!patientMatchesPayload(rows[0], payload)) {
        throw createPatientConflictError(rows[0], payload.studentId || payload.employeeId)
      }
      await updatePatientRecordFromVisit(connection, rows[0].id, payload)
      return rows[0].id
    }
  }

  const recordId = payload.studentId || payload.employeeId
  if (recordId) {
    const [rows] = await connection.execute(
      'SELECT * FROM patient_records WHERE student_id = ? OR employee_id = ? LIMIT 1',
      [recordId, recordId]
    )

    if (rows[0]) {
      if (!patientMatchesPayload(rows[0], payload)) {
        throw createPatientConflictError(rows[0], recordId)
      }
      await updatePatientRecordFromVisit(connection, rows[0].id, payload)
      return rows[0].id
    }
  }

  if (!recordId && payload.name) {
    const [rows] = await connection.execute(
      'SELECT id FROM patient_records WHERE LOWER(name) = LOWER(?) AND position = ? LIMIT 1',
      [payload.name, payload.position]
    )

    if (rows[0]) {
      await updatePatientRecordFromVisit(connection, rows[0].id, payload)
      return rows[0].id
    }
  }

  const [result] = await connection.execute(
    `INSERT INTO patient_records
     (student_id, employee_id, name, last_name, first_name, middle_name, position, department, course, year_level, section,
      birthdate, gender, place_of_birth, father_name, father_occupation, mother_name,
      mother_occupation, contact, address, emergency_contact_name, emergency_contact_phone,
      emergency_contact_name_2, emergency_contact_phone_2, blood_type, complete_immunization,
      missed_immunization, medical_condition, medical_condition_details, hospitalized,
      hospitalization_details, allergy, allergy_details, covid_vaccination, covid_first_dose,
      covid_second_dose, covid_booster_1, covid_booster_2, health_conditions_json, surgery,
      surgery_details, maintenance_medication, maintenance_medications, signature_name, registered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.studentId,
      payload.employeeId,
      payload.name,
      payload.lastName,
      payload.firstName,
      payload.middleName,
      payload.position,
      payload.department,
      payload.course,
      payload.yearLevel,
      payload.section,
      payload.birthdate,
      payload.gender,
      payload.placeOfBirth,
      payload.fatherName,
      payload.fatherOccupation,
      payload.motherName,
      payload.motherOccupation,
      payload.contact,
      payload.address,
      payload.emergencyContactName,
      payload.emergencyContactPhone,
      payload.emergencyContactName2,
      payload.emergencyContactPhone2,
      payload.bloodType,
      payload.completeImmunization,
      payload.missedImmunization,
      payload.medicalCondition,
      payload.medicalConditionDetails,
      payload.hospitalized,
      payload.hospitalizationDetails,
      payload.allergy,
      payload.allergyDetails,
      payload.covidVaccination,
      payload.covidFirstDose,
      payload.covidSecondDose,
      payload.covidBooster1,
      payload.covidBooster2,
      payload.healthConditions,
      payload.surgery,
      payload.surgeryDetails,
      payload.maintenanceMedication,
      payload.maintenanceMedications,
      payload.signatureName,
      payload.visitDateTime,
    ]
  )
  return result.insertId
}

async function replaceVisitMedicines(connection, visitId, medicines = [], reconcileStock = false, userId = null) {
  await ensureVisitMedicineQuantityColumn(connection)
  if (reconcileStock) await ensureMedicineTransactionSchema(connection)

  const [previousRows] = await connection.execute(
    `SELECT vm.medicine_id, vm.quantity, m.id, m.name, m.quantity AS stock_quantity
     FROM visit_medicines vm
     LEFT JOIN medicines m ON m.id = vm.medicine_id
     WHERE vm.visit_id = ?`,
    [visitId]
  )

  const previousQuantities = new Map()
  const medicinesById = new Map()
  previousRows.forEach((row) => {
    if (!row.medicine_id || !row.id) return
    previousQuantities.set(row.id, (previousQuantities.get(row.id) || 0) + Number(row.quantity || 0))
    medicinesById.set(row.id, {
      id: row.id,
      name: row.name,
      quantity: Number(row.stock_quantity) || 0,
    })
  })

  await connection.execute('DELETE FROM visit_medicines WHERE visit_id = ?', [visitId])

  const nextQuantities = new Map()
  for (const item of medicines) {
    const name = typeof item === 'string' ? item : item?.name
    const requestedQuantity = Math.max(1, Math.floor(Number(item?.quantity) || 1))
    const [medicineRows] = await connection.execute(
      'SELECT id, name, quantity FROM medicines WHERE name = ? LIMIT 1',
      [name]
    )
    const medicine = medicineRows[0]
    if (!medicine) continue

    const nextQuantity = (nextQuantities.get(medicine.id) || 0) + requestedQuantity
    nextQuantities.set(medicine.id, nextQuantity)
    medicinesById.set(medicine.id, { ...medicine, quantity: Number(medicine.quantity) || 0 })

    await connection.execute(
      'INSERT INTO visit_medicines (visit_id, medicine_id, medicine_name, quantity) VALUES (?, ?, ?, ?)',
      [visitId, medicine.id, name, requestedQuantity]
    )
  }

  if (!reconcileStock) return

  const medicineIds = new Set([...previousQuantities.keys(), ...nextQuantities.keys()])
  for (const medicineId of medicineIds) {
    const medicine = medicinesById.get(medicineId)
    if (!medicine) continue

    const previousQuantity = previousQuantities.get(medicineId) || 0
    const nextQuantity = nextQuantities.get(medicineId) || 0
    const changeQuantity = nextQuantity - previousQuantity
    if (!changeQuantity) continue

    const availableQuantity = Number(medicine.quantity) || 0
    if (changeQuantity > availableQuantity) {
      const error = new Error(`${medicine.name} does not have enough stock for this quantity.`)
      error.statusCode = 400
      throw error
    }

    const updatedQuantity = availableQuantity - changeQuantity
    await connection.execute('UPDATE medicines SET quantity = ? WHERE id = ?', [updatedQuantity, medicine.id])
    await recordMedicineTransaction(connection, medicine, -changeQuantity)
    await createMedicineStockNotifications(connection, {
      medicine,
      previousQuantity: availableQuantity,
      nextQuantity: updatedQuantity,
      changeQuantity: -changeQuantity,
      userId,
    })
  }
}

async function getVisitById(id, connection = pool) {
  await ensureVisitMedicineQuantityColumn(connection)
  const [rows] = await connection.execute(
    `SELECT v.*, GROUP_CONCAT(CONCAT(vm.medicine_name, '::', vm.quantity) ORDER BY vm.id SEPARATOR '||') AS medicines
     FROM visits v
     LEFT JOIN visit_medicines vm ON vm.visit_id = v.id
     WHERE v.id = ?
     GROUP BY v.id`,
    [id]
  )
  return rows[0] ? mapVisit(rows[0]) : null
}

router.get('/', async (req, res, next) => {
  try {
    await ensureVisitMedicineQuantityColumn(pool)
    const clauses = []
    const params = []

    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`
      clauses.push(`(v.name LIKE ? OR v.student_id LIKE ? OR v.employee_id LIKE ?
        OR v.position LIKE ? OR v.department LIKE ? OR v.course LIKE ?
        OR v.concern LIKE ? OR v.signs_symptoms LIKE ? OR vm.medicine_name LIKE ?)`)
      params.push(q, q, q, q, q, q, q, q, q)
    }

    if (req.query.concern) {
      clauses.push("COALESCE(NULLIF(v.signs_symptoms, ''), v.concern, 'General check-up') = ?")
      params.push(req.query.concern)
    }

    if (req.query.status === 'active') clauses.push('v.discharged_at IS NULL')
    if (req.query.status === 'discharged') clauses.push('v.discharged_at IS NOT NULL')

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const [rows] = await pool.execute(
      `SELECT v.*, GROUP_CONCAT(DISTINCT CONCAT(vm.medicine_name, '::', vm.quantity) ORDER BY vm.id SEPARATOR '||') AS medicines
       FROM visits v
       LEFT JOIN visit_medicines vm ON vm.visit_id = v.id
       ${where}
       GROUP BY v.id
       ORDER BY v.visit_datetime DESC, v.id DESC`,
      params
    )
    res.json({ data: rows.map(mapVisit) })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    await ensurePatientImportSchema()
    const payload = visitPayload(req.body)
    if (!payload.name) return res.status(400).json({ message: 'Patient name is required.' })

    const visit = await transaction(async (connection) => {
      const patientRecordId = await findOrCreatePatient(connection, payload)
      const [result] = await connection.execute(
        `INSERT INTO visits
         (patient_record_id, name, position, department, student_id, employee_id, course,
          year_level, section, concern, temperature, height, weight, blood_pressure,
          respiratory_rate, pulse_rate, oxygen_saturation, signs_symptoms, clinic_visit_remarks, visit_remarks,
          medication_first_aid, medication_remarks, visit_datetime, discharged_at,
          sent_home, sent_home_date, sent_home_time, attending_physician, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patientRecordId,
          payload.name,
          payload.position,
          payload.department,
          payload.studentId,
          payload.employeeId,
          payload.course,
          payload.yearLevel,
          payload.section,
          payload.concern,
          payload.temperature,
          payload.height,
          payload.weight,
          payload.bloodPressure,
          payload.respiratoryRate,
          payload.pulseRate,
          payload.oxygenSaturation,
          payload.signsSymptoms,
          payload.clinicVisitRemarks,
          payload.visitRemarks,
          payload.medicationFirstAid,
          payload.medicationRemarks,
          payload.visitDateTime,
          payload.dischargedAt,
          payload.sentHome,
          payload.sentHomeDate,
          payload.sentHomeTime,
          payload.attendingPhysician,
          payload.timestamp,
        ]
      )
      await replaceVisitMedicines(connection, result.insertId, payload.medicines, true, req.user.id)
      const createdVisit = await getVisitById(result.insertId, connection)
      await createVisitNotification(connection, createdVisit, req.user.id)
      if (createdVisit.sentHome) {
        await createSentHomeNotification(connection, createdVisit, req.user.id)
      }
      return createdVisit
    })

    const sentHomeNotification = await sendSentHomeNotification(visit, payload)
    await createParentEmailNotification(
      pool,
      visit,
      req.user.id,
      sentHomeNotification?.status === 'missing_email' ? 'failed' : sentHomeNotification?.status
    )
    const data = sentHomeNotification?.status === 'sent' ? await getVisitById(visit.id) : visit

    res.status(201).json({ data, sentHomeNotification })
  } catch (error) {
    next(error)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    await ensurePatientImportSchema()
    const payload = visitPayload(req.body)
    if (!payload.name) return res.status(400).json({ message: 'Patient name is required.' })

    const visit = await transaction(async (connection) => {
      const previousVisit = await getVisitById(req.params.id, connection)
      if (!previousVisit) return null

      const patientRecordId = await findOrCreatePatient(connection, payload)
      const [result] = await connection.execute(
        `UPDATE visits
         SET patient_record_id = ?, name = ?, position = ?, department = ?, student_id = ?,
             employee_id = ?, course = ?, year_level = ?, section = ?, concern = ?,
             temperature = ?, height = ?, weight = ?, blood_pressure = ?,
             respiratory_rate = ?, pulse_rate = ?, oxygen_saturation = ?,
             signs_symptoms = ?, clinic_visit_remarks = ?, visit_remarks = ?, medication_first_aid = ?,
             medication_remarks = ?, visit_datetime = ?, discharged_at = ?,
             sent_home = ?, sent_home_date = ?, sent_home_time = ?, attending_physician = ?
         WHERE id = ?`,
        [
          patientRecordId,
          payload.name,
          payload.position,
          payload.department,
          payload.studentId,
          payload.employeeId,
          payload.course,
          payload.yearLevel,
          payload.section,
          payload.concern,
          payload.temperature,
          payload.height,
          payload.weight,
          payload.bloodPressure,
          payload.respiratoryRate,
          payload.pulseRate,
          payload.oxygenSaturation,
          payload.signsSymptoms,
          payload.clinicVisitRemarks,
          payload.visitRemarks,
          payload.medicationFirstAid,
          payload.medicationRemarks,
          payload.visitDateTime,
          payload.dischargedAt,
          payload.sentHome,
          payload.sentHomeDate,
          payload.sentHomeTime,
          payload.attendingPhysician,
          req.params.id,
        ]
      )
      if (!result.affectedRows) return null
      await replaceVisitMedicines(connection, req.params.id, payload.medicines, true, req.user.id)
      const updatedVisit = await getVisitById(req.params.id, connection)
      if (updatedVisit.sentHome && !previousVisit.sentHome) {
        await createSentHomeNotification(connection, updatedVisit, req.user.id)
      }
      return updatedVisit
    })

    if (!visit) return res.status(404).json({ message: 'Visit not found.' })

    const sentHomeNotification = await sendSentHomeNotification(visit, payload)
    await createParentEmailNotification(
      pool,
      visit,
      req.user.id,
      sentHomeNotification?.status === 'missing_email' ? 'failed' : sentHomeNotification?.status
    )
    const data = sentHomeNotification?.status === 'sent' ? await getVisitById(visit.id) : visit

    res.json({ data, sentHomeNotification })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/discharge', async (req, res, next) => {
  try {
    const dischargedAt = toMysqlDateTime(req.body.dischargedAt) || toMysqlDateTime(new Date())
    const [result] = await pool.execute(
      'UPDATE visits SET discharged_at = COALESCE(discharged_at, ?) WHERE id = ?',
      [dischargedAt, req.params.id]
    )
    if (!result.affectedRows) return res.status(404).json({ message: 'Visit not found.' })
    res.json({ data: await getVisitById(req.params.id) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const [visitRows] = await pool.execute('SELECT patient_record_id FROM visits WHERE id = ?', [req.params.id])
    const patientRecordId = visitRows[0]?.patient_record_id
    const [result] = await pool.execute('DELETE FROM visits WHERE id = ?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ message: 'Visit not found.' })

    if (req.query.deleteOrphanPatient === 'true' && patientRecordId) {
      await pool.execute(
        `DELETE pr FROM patient_records pr
         LEFT JOIN visits v ON v.patient_record_id = pr.id
         WHERE pr.id = ? AND v.id IS NULL`,
        [patientRecordId]
      )
    }

    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.get('/meta/concerns', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT COALESCE(NULLIF(signs_symptoms, ''), concern, 'General check-up') AS concern, COUNT(*) AS count
       FROM visits
       GROUP BY COALESCE(NULLIF(signs_symptoms, ''), concern, 'General check-up')
       ORDER BY concern ASC`
    )
    res.json({ data: rows.map((row) => ({ concern: row.concern, count: Number(row.count) })) })
  } catch (error) {
    next(error)
  }
})

export default router
