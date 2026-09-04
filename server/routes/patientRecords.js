import express from 'express'
import { pool, transaction } from '../db.js'
import { createImportUpload } from '../middleware/importUpload.js'
import {
  confirmPatientImport,
  ensurePatientImportSchema,
  previewPatientImport,
} from '../services/patientImportService.js'
import { mapPatient, toMysqlDate, toMysqlDateTime, toNullableString } from '../utils/format.js'

const router = express.Router()
const importUpload = createImportUpload('patient-records')

function toNullableBoolean(value) {
  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  const normalized = String(value).trim().toLowerCase()
  if (['yes', 'true', '1'].includes(normalized)) return 1
  if (['no', 'false', '0'].includes(normalized)) return 0
  return null
}

function patientPayload(body) {
  const position = body.position || 'Student'
  const isStudent = !position || position === 'Student'

  return {
    studentId: isStudent ? toNullableString(body.studentId) : null,
    employeeId: !isStudent ? toNullableString(body.employeeId) : null,
    name: toNullableString(body.name),
    position,
    department: toNullableString(body.department),
    course: isStudent ? toNullableString(body.course) : null,
    yearLevel: isStudent ? toNullableString(body.yearLevel) : null,
    section: isStudent ? toNullableString(body.section) : null,
    birthdate: toMysqlDate(body.birthdate),
    gender: toNullableString(body.gender),
    placeOfBirth: toNullableString(body.placeOfBirth),
    fatherName: toNullableString(body.fatherName),
    fatherOccupation: toNullableString(body.fatherOccupation),
    motherName: toNullableString(body.motherName),
    motherOccupation: toNullableString(body.motherOccupation),
    contact: toNullableString(body.contact),
    address: toNullableString(body.address),
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
    registeredAt: toMysqlDateTime(body.registeredAt) || toMysqlDateTime(new Date()),
  }
}

async function getPatientById(id, connection = pool) {
  const [rows] = await connection.execute('SELECT * FROM patient_records WHERE id = ?', [id])
  return rows[0] ? mapPatient(rows[0]) : null
}

function hasManagePermission(user) {
  return ['nurse', 'admin'].includes(user?.role)
}

function requireManagePermission(req, res, next) {
  if (!hasManagePermission(req.user)) {
    res.status(403).json({ success: false, message: 'You are not allowed to import patient records.' })
    return
  }
  next()
}

router.get('/', async (req, res, next) => {
  try {
    const q = `%${String(req.query.q || '').trim()}%`
    const hasQuery = q !== '%%'
    const sql = hasQuery
      ? `SELECT * FROM patient_records
         WHERE name LIKE ? OR student_id LIKE ? OR employee_id LIKE ?
           OR position LIKE ? OR department LIKE ? OR course LIKE ?
         ORDER BY registered_at DESC, id DESC`
      : 'SELECT * FROM patient_records ORDER BY registered_at DESC, id DESC'
    const params = hasQuery ? [q, q, q, q, q, q] : []
    const [rows] = await pool.execute(sql, params)
    res.json({ data: rows.map(mapPatient) })
  } catch (error) {
    next(error)
  }
})

router.post('/import/preview', requireManagePermission, importUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'Please upload a .csv, .xlsx, or .xls file.',
        errors: [],
      })
      return
    }

    const result = await previewPatientImport(req.file)
    res.json({
      success: result.errors.length === 0,
      message: result.errors.length ? 'Import validation failed.' : 'Import preview generated.',
      data: result,
      errors: result.errors,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/import/confirm', requireManagePermission, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : []
    if (!rows.length) {
      res.status(400).json({
        success: false,
        message: 'No import rows were provided.',
        errors: [],
      })
      return
    }

    const result = await confirmPatientImport(rows, {
      userId: req.user?.id,
      fileName: req.body.fileName,
    })

    res.status(201).json({
      success: true,
      message: 'Import completed successfully.',
      data: result,
      summary: result.summary,
      errors: result.errors,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const patient = await getPatientById(req.params.id)
    if (!patient) return res.status(404).json({ message: 'Patient record not found.' })
    res.json({ data: patient })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    await ensurePatientImportSchema()
    const payload = patientPayload(req.body)
    if (!payload.name) return res.status(400).json({ message: 'Full name is required.' })

    const [result] = await pool.execute(
      `INSERT INTO patient_records
       (student_id, employee_id, name, position, department, course, year_level, section,
        birthdate, gender, place_of_birth, father_name, father_occupation, mother_name,
        mother_occupation, contact, address, emergency_contact_name, emergency_contact_phone,
        emergency_contact_name_2, emergency_contact_phone_2, blood_type, complete_immunization,
        missed_immunization, medical_condition, medical_condition_details, hospitalized,
        hospitalization_details, allergy, allergy_details, covid_vaccination, covid_first_dose,
        covid_second_dose, covid_booster_1, covid_booster_2, health_conditions_json, surgery,
        surgery_details, maintenance_medication, maintenance_medications, signature_name, registered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.studentId,
        payload.employeeId,
        payload.name,
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
        payload.registeredAt,
      ]
    )

    res.status(201).json({ data: await getPatientById(result.insertId) })
  } catch (error) {
    next(error)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    await ensurePatientImportSchema()
    const payload = patientPayload(req.body)
    if (!payload.name) return res.status(400).json({ message: 'Full name is required.' })

    const patient = await transaction(async (connection) => {
      await connection.execute(
        `UPDATE patient_records
         SET student_id = ?, employee_id = ?, name = ?, position = ?, department = ?,
             course = ?, year_level = ?, section = ?, birthdate = ?, gender = ?,
             place_of_birth = ?, father_name = ?, father_occupation = ?, mother_name = ?,
             mother_occupation = ?, contact = ?, address = ?, emergency_contact_name = ?,
             emergency_contact_phone = ?, emergency_contact_name_2 = ?, emergency_contact_phone_2 = ?,
             blood_type = ?, complete_immunization = ?, missed_immunization = ?,
             medical_condition = ?, medical_condition_details = ?, hospitalized = ?,
             hospitalization_details = ?, allergy = ?, allergy_details = ?, covid_vaccination = ?,
             covid_first_dose = ?, covid_second_dose = ?, covid_booster_1 = ?,
             covid_booster_2 = ?, health_conditions_json = ?, surgery = ?, surgery_details = ?,
             maintenance_medication = ?, maintenance_medications = ?, signature_name = ?
         WHERE id = ?`,
        [
          payload.studentId,
          payload.employeeId,
          payload.name,
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
          req.params.id,
        ]
      )
      await connection.execute(
        `UPDATE visits
         SET name = ?, position = ?, department = ?, student_id = ?, employee_id = ?,
             course = ?, year_level = ?, section = ?
         WHERE patient_record_id = ?`,
        [
          payload.name,
          payload.position,
          payload.department,
          payload.studentId,
          payload.employeeId,
          payload.course,
          payload.yearLevel,
          payload.section,
          req.params.id,
        ]
      )
      return getPatientById(req.params.id, connection)
    })

    if (!patient) return res.status(404).json({ message: 'Patient record not found.' })
    res.json({ data: patient })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM patient_records WHERE id = ?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ message: 'Patient record not found.' })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

export default router
