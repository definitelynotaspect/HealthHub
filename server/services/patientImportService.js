import fs from 'node:fs/promises'
import xlsx from 'xlsx'
import { pool, transaction } from '../db.js'
import { toMysqlDate, toMysqlDateTime, toNullableString } from '../utils/format.js'

export const PATIENT_IMPORT_REQUIRED_FIELDS = ['student_id', 'name', 'role']

const maxRows = 1000
const headerAliases = {
  student_id: ['student_id', 'student id', 'student no', 'student number', 'patient_id', 'patient id', 'id'],
  name: ['name', 'full name', 'patient', 'patient name', 'student name'],
  role: ['role', 'position', 'type'],
  course_department: ['course_department', 'course department', 'course/department', 'department/course', 'department', 'course'],
  department: ['department'],
  course: ['course', 'program'],
  year_level: ['year_level', 'year level', 'year', 'level'],
  section: ['section', 'block', 'block / section'],
  contact: ['contact', 'contact number', 'phone', 'phone number'],
  address: ['address'],
  birthdate: ['birthdate', 'birth date', 'date of birth', 'dob'],
  gender: ['gender', 'sex'],
  place_of_birth: ['place_of_birth', 'place of birth', 'birth place'],
  father_name: ['father_name', "father's name", 'father name'],
  father_occupation: ['father_occupation', "father's occupation", 'father occupation'],
  mother_name: ['mother_name', "mother's name", 'mother name'],
  mother_occupation: ['mother_occupation', "mother's occupation", 'mother occupation'],
  emergency_contact_name: ['emergency_contact_name', 'emergency contact person', 'emergency contact'],
  emergency_contact_phone: ['emergency_contact_phone', 'tel/cp no', 'tel cp no', 'emergency phone', 'emergency contact number'],
  emergency_contact_name_2: ['emergency_contact_name_2', 'emergency contact person 2', 'emergency contact 2'],
  emergency_contact_phone_2: ['emergency_contact_phone_2', 'tel/cp no 2', 'tel cp no 2', 'emergency phone 2'],
  blood_type: ['blood_type', 'blood type'],
  concern: ['concern', 'reason', 'reason for visit', 'complaint', 'chief complaint'],
  visit_datetime: ['visit_datetime', 'visit date time', 'time in', 'date and time of visit', 'visit date', 'date'],
  temperature: ['temperature', 'temp'],
  height: ['height', 'ht'],
  weight: ['weight', 'wt'],
  blood_pressure: ['blood_pressure', 'blood pressure', 'bp'],
  respiratory_rate: ['respiratory_rate', 'respiratory rate', 'rr'],
  pulse_rate: ['pulse_rate', 'pulse rate', 'pr'],
  oxygen_saturation: ['oxygen_saturation', 'oxygen saturation', 'o2 sat', 'o2 sat (%)', '02 sat', '02 sat (%)'],
  signs_symptoms: ['signs_symptoms', 'signs symptoms', 'signs and symptoms', 'major complaint', 'signs and symptoms/major complain'],
  visit_remarks: ['visit_remarks', 'visit remarks', 'remarks'],
  medication_first_aid: ['medication_first_aid', 'medication first aid', 'medication/first aid provided', 'first aid', 'first aid provided'],
  medication_remarks: ['medication_remarks', 'medication remarks', 'medicine remarks'],
  medicine: ['medicine', 'medicines', 'medicine given', 'medication', 'medications'],
  discharged_at: ['discharged_at', 'time out', 'timeout', 'discharge time', 'discharged at'],
  sent_home: ['sent_home', 'sent home'],
  sent_home_date: ['sent_home_date', 'sent home date'],
  sent_home_time: ['sent_home_time', 'sent home time'],
  attending_physician: ['attending_physician', 'attending physician', 'physician'],
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function getImportValueFromAliases(row, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader)
  const entry = Object.entries(row).find(([key]) => normalizedAliases.includes(normalizeHeader(key)))
  return String(entry?.[1] ?? '').trim()
}

function getImportValue(row, field) {
  const aliases = headerAliases[field] || [field]
  return getImportValueFromAliases(row, aliases)
}

function hasImportValue(row, field) {
  return Boolean(getImportValue(row, field))
}

function hasRequiredColumns(rows) {
  const firstRow = rows[0] || {}
  const headers = Object.keys(firstRow).map(normalizeHeader)

  return PATIENT_IMPORT_REQUIRED_FIELDS.every((field) => {
    const aliases = (headerAliases[field] || [field]).map(normalizeHeader)
    return aliases.some((alias) => headers.includes(alias))
  })
}

function splitCourseDepartment(value, role) {
  const trimmed = String(value ?? '').trim()
  const isStudent = !role || role === 'Student'
  if (!trimmed) return { department: null, course: null }
  if (!isStudent) return { department: trimmed, course: null }

  const [department, ...courseParts] = trimmed.split(/\s+-\s+/)
  return {
    department: toNullableString(department || trimmed),
    course: toNullableString(courseParts.join(' - ')),
  }
}

function normalizeRole(value) {
  const role = String(value || 'Student').trim()
  const match = ['Student', 'Staff', 'Instructor', 'Guard', 'Maintenance', 'Admin']
    .find((option) => option.toLowerCase() === role.toLowerCase())
  return match || role
}

function normalizeBirthdate(value) {
  return toMysqlDate(value)
}

function normalizeBoolean(value) {
  const normalized = normalizeSignaturePart(value)
  if (!normalized) return null
  if (['yes', 'y', 'true', '1', 'checked'].includes(normalized)) return 1
  if (['no', 'n', 'false', '0', 'unchecked'].includes(normalized)) return 0
  return null
}

function normalizeImportDateTime(value) {
  return toMysqlDateTime(value) || null
}

function normalizeContact(value) {
  const trimmed = String(value ?? '').trim()
  const digits = trimmed.replace(/\D/g, '')

  if (/^9\d{9}$/.test(digits)) return `0${digits}`
  if (/^63\d{10}$/.test(digits)) return `0${digits.slice(2)}`
  return trimmed
}

function isTimeOnlyValue(value) {
  return /^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?|\d{1,2}\s*(?:AM|PM))$/i
    .test(String(value ?? '').trim())
}

function isBlankDateTimeValue(value) {
  const normalized = normalizeSignaturePart(value)
  return !normalized || [
    'not timed out',
    'not timeout',
    'not discharged',
    'no time out',
    'none',
    'n/a',
    'na',
    '-',
  ].includes(normalized)
}

function getImportDateTime(row, timeAliases, { fallbackToDate = true } = {}) {
  const dateValue = getImportValueFromAliases(row, ['date', 'visit date'])
  const timeValue = getImportValueFromAliases(row, timeAliases)

  if (isBlankDateTimeValue(timeValue)) return fallbackToDate ? normalizeImportDateTime(dateValue) : null

  if (dateValue && timeValue && isTimeOnlyValue(timeValue)) {
    return normalizeImportDateTime(`${dateValue} ${timeValue}`)
  }

  return normalizeImportDateTime(timeValue) || (fallbackToDate ? normalizeImportDateTime(dateValue) : null)
}

function normalizeMedicineList(value) {
  return String(value ?? '')
    .split(/\s*(?:\/|,|\r?\n)\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeImportRow(row, rowNumber) {
  const importId = getImportValue(row, 'student_id')
  const name = getImportValue(row, 'name')
  const role = normalizeRole(getImportValue(row, 'role'))
  const isStudent = role === 'Student'
  const courseDepartment = getImportValue(row, 'course_department')
  const courseInput = getImportValue(row, 'course')
  const birthdateInput = getImportValue(row, 'birthdate')
  const { department, course } = splitCourseDepartment(courseDepartment, role)

  return {
    row: rowNumber,
    studentId: isStudent ? importId : '',
    employeeId: isStudent ? '' : importId,
    name,
    role,
    courseDepartment,
    department: department || '',
    course: course || (role === 'Student' ? courseInput : '') || '',
    yearLevel: isStudent ? getImportValue(row, 'year_level') : '',
    section: isStudent ? getImportValue(row, 'section') : '',
    birthdate: normalizeBirthdate(birthdateInput),
    birthdateInput,
    gender: getImportValue(row, 'gender'),
    placeOfBirth: getImportValue(row, 'place_of_birth'),
    fatherName: getImportValue(row, 'father_name'),
    fatherOccupation: getImportValue(row, 'father_occupation'),
    motherName: getImportValue(row, 'mother_name'),
    motherOccupation: getImportValue(row, 'mother_occupation'),
    contact: normalizeContact(getImportValue(row, 'contact')),
    address: getImportValue(row, 'address'),
    emergencyContactName: getImportValue(row, 'emergency_contact_name'),
    emergencyContactPhone: normalizeContact(getImportValue(row, 'emergency_contact_phone')),
    emergencyContactName2: getImportValue(row, 'emergency_contact_name_2'),
    emergencyContactPhone2: normalizeContact(getImportValue(row, 'emergency_contact_phone_2')),
    bloodType: getImportValue(row, 'blood_type'),
    concern: getImportValue(row, 'concern') || 'General check-up',
    temperature: getImportValue(row, 'temperature'),
    height: getImportValue(row, 'height'),
    weight: getImportValue(row, 'weight'),
    bloodPressure: getImportValue(row, 'blood_pressure'),
    respiratoryRate: getImportValue(row, 'respiratory_rate'),
    pulseRate: getImportValue(row, 'pulse_rate'),
    oxygenSaturation: getImportValue(row, 'oxygen_saturation'),
    signsSymptoms: getImportValue(row, 'signs_symptoms'),
    visitRemarks: getImportValue(row, 'visit_remarks'),
    medicationFirstAid: getImportValue(row, 'medication_first_aid'),
    medicationRemarks: getImportValue(row, 'medication_remarks'),
    visitDateTime: getImportDateTime(row, ['time in', 'visit_datetime', 'visit date time', 'date and time of visit']),
    medicines: normalizeMedicineList(getImportValue(row, 'medicine')),
    dischargedAt: getImportDateTime(
      row,
      ['time out', 'timeout', 'discharged_at', 'discharge time', 'discharged at'],
      { fallbackToDate: false }
    ),
    sentHome: normalizeBoolean(getImportValue(row, 'sent_home')) || 0,
    sentHomeDate: toMysqlDate(getImportValue(row, 'sent_home_date')),
    sentHomeTime: toNullableString(getImportValue(row, 'sent_home_time')),
    attendingPhysician: getImportValue(row, 'attending_physician'),
  }
}

function isEmptyImportRow(row) {
  return Object.values(row).every((value) => !String(value ?? '').trim())
}

function isVisitHistoryDateRow(row) {
  const populatedEntries = Object.entries(row)
    .filter(([, value]) => String(value ?? '').trim())

  if (populatedEntries.length !== 1) return false

  const [key] = populatedEntries[0]
  const looksLikeDateColumn = normalizeHeader(key) === 'date'
  const hasNoPatientFields = ['student_id', 'name', 'role', 'course_department']
    .every((field) => !hasImportValue(row, field))

  return looksLikeDateColumn && hasNoPatientFields
}

function createFieldError(row, field, message) {
  return { row, field, message }
}

function getRecordImportKey(record) {
  const patientId = record.studentId || record.employeeId
  if (!patientId) return ''
  return `${record.studentId ? 'student' : 'employee'}:${patientId.toLowerCase()}`
}

function normalizeSignaturePart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function patientMatchesImportRow(patient, row) {
  const patientName = normalizeSignaturePart(patient.name)
  const rowName = normalizeSignaturePart(row.name)
  const patientPosition = normalizeSignaturePart(patient.position || 'Student')
  const rowPosition = normalizeSignaturePart(row.role || 'Student')

  if (patientName && rowName && patientName !== rowName) return false
  if (patientPosition && rowPosition && patientPosition !== rowPosition) return false
  return true
}

function createPatientConflictError(patient, recordId) {
  const error = new Error(
    `${recordId || 'This ID'} already belongs to ${patient.name}. Please fix the spreadsheet ID or patient name.`
  )
  error.statusCode = 409
  return error
}

function getVisitImportSignature(record) {
  const medicines = (record.medicines || [])
    .map(normalizeSignaturePart)
    .filter(Boolean)
    .sort()
    .join('|')

  return [
    record.studentId ? 'student' : 'employee',
    record.studentId || record.employeeId || '',
    record.name,
    record.role,
    record.department,
    record.course,
    record.yearLevel,
    record.section,
    record.concern || 'General check-up',
    record.visitDateTime || '',
    record.dischargedAt || '',
    medicines,
  ].map(normalizeSignaturePart).join('::')
}

function isImportableStatus(status) {
  return ['Valid', 'Update'].includes(status)
}

export function validateImportRecord(record) {
  const errors = []
  const patientId = record.studentId || record.employeeId

  if (!patientId) errors.push(createFieldError(record.row, 'patient_id', 'Patient ID is required.'))
  if (!record.name) errors.push(createFieldError(record.row, 'name', 'Name is required.'))
  if (!record.role) errors.push(createFieldError(record.row, 'role', 'Role is required.'))
  if (patientId && !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(patientId)) {
    errors.push(createFieldError(record.row, 'patient_id', 'Patient ID format is invalid.'))
  }
  if (record.birthdateInput && !record.birthdate) {
    errors.push(createFieldError(record.row, 'birthdate', 'Birthdate is invalid.'))
  }

  return errors
}

export function buildImportPreview(records, existingIds, existingVisitSignatures = new Set()) {
  const seenVisitSignatures = new Set()

  return records.map((record) => {
    const importKey = getRecordImportKey(record)
    const visitSignature = getVisitImportSignature(record)
    const errors = validateImportRecord(record)
    let status = errors.length ? 'Invalid' : 'Valid'

    if (!errors.length && existingVisitSignatures.has(visitSignature)) {
      status = 'Duplicate'
    } else if (!errors.length && seenVisitSignatures.has(visitSignature)) {
      status = 'Duplicate'
    } else if (!errors.length && importKey && existingIds.has(importKey)) {
      status = 'Update'
    }

    if (!errors.length) seenVisitSignatures.add(visitSignature)

    return {
      ...record,
      status,
      errors,
    }
  })
}

export function summarizePreviewRows(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1
      if (isImportableStatus(row.status)) summary.valid += 1
      else if (row.status === 'Duplicate') summary.duplicates += 1
      else {
        summary.failed += 1
      }
      return summary
    },
    { total: 0, valid: 0, duplicates: 0, failed: 0 }
  )
}

export async function getExistingPatientIds(connection = pool) {
  const [rows] = await connection.execute(
    'SELECT student_id, employee_id FROM patient_records WHERE student_id IS NOT NULL OR employee_id IS NOT NULL'
  )
  return new Set(rows.flatMap((row) => [
    row.student_id ? `student:${row.student_id.toLowerCase()}` : null,
    row.employee_id ? `employee:${row.employee_id.toLowerCase()}` : null,
  ]).filter(Boolean))
}

export async function getExistingVisitSignatures(connection = pool) {
  const [rows] = await connection.execute(
    `SELECT v.name, v.position, v.department, v.student_id, v.employee_id, v.course,
            v.year_level, v.section, v.concern, v.visit_datetime, v.discharged_at,
            GROUP_CONCAT(DISTINCT vm.medicine_name ORDER BY vm.medicine_name SEPARATOR '||') AS medicines
     FROM visits v
     LEFT JOIN visit_medicines vm ON vm.visit_id = v.id
     GROUP BY v.id`
  )

  return new Set(rows.map((row) => getVisitImportSignature({
    studentId: row.student_id || '',
    employeeId: row.employee_id || '',
    name: row.name || '',
    role: row.position || 'Student',
    department: row.department || '',
    course: row.course || '',
    yearLevel: row.year_level || '',
    section: row.section || '',
    concern: row.concern || 'General check-up',
    visitDateTime: toMysqlDateTime(row.visit_datetime) || '',
    dischargedAt: toMysqlDateTime(row.discharged_at) || '',
    medicines: row.medicines ? String(row.medicines).split('||').filter(Boolean) : [],
  })))
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  )
  return Boolean(rows[0])
}

export async function ensurePatientImportSchema(connection = pool) {
  const patientColumns = [
    ['birthdate', 'DATE NULL AFTER section'],
    ['gender', 'VARCHAR(50) NULL AFTER birthdate'],
    ['place_of_birth', 'VARCHAR(191) NULL AFTER gender'],
    ['father_name', 'VARCHAR(191) NULL AFTER place_of_birth'],
    ['father_occupation', 'VARCHAR(191) NULL AFTER father_name'],
    ['mother_name', 'VARCHAR(191) NULL AFTER father_occupation'],
    ['mother_occupation', 'VARCHAR(191) NULL AFTER mother_name'],
    ['emergency_contact_name', 'VARCHAR(191) NULL AFTER address'],
    ['emergency_contact_phone', 'VARCHAR(80) NULL AFTER emergency_contact_name'],
    ['emergency_contact_name_2', 'VARCHAR(191) NULL AFTER emergency_contact_phone'],
    ['emergency_contact_phone_2', 'VARCHAR(80) NULL AFTER emergency_contact_name_2'],
    ['blood_type', 'VARCHAR(20) NULL AFTER emergency_contact_phone_2'],
    ['complete_immunization', 'TINYINT(1) NULL AFTER blood_type'],
    ['missed_immunization', 'VARCHAR(255) NULL AFTER complete_immunization'],
    ['medical_condition', 'TINYINT(1) NULL AFTER missed_immunization'],
    ['medical_condition_details', 'VARCHAR(255) NULL AFTER medical_condition'],
    ['hospitalized', 'TINYINT(1) NULL AFTER medical_condition_details'],
    ['hospitalization_details', 'VARCHAR(255) NULL AFTER hospitalized'],
    ['allergy', 'TINYINT(1) NULL AFTER hospitalization_details'],
    ['allergy_details', 'VARCHAR(255) NULL AFTER allergy'],
    ['covid_vaccination', 'TINYINT(1) NULL AFTER allergy_details'],
    ['covid_first_dose', 'DATE NULL AFTER covid_vaccination'],
    ['covid_second_dose', 'DATE NULL AFTER covid_first_dose'],
    ['covid_booster_1', 'DATE NULL AFTER covid_second_dose'],
    ['covid_booster_2', 'DATE NULL AFTER covid_booster_1'],
    ['health_conditions_json', 'JSON NULL AFTER covid_booster_2'],
    ['surgery', 'TINYINT(1) NULL AFTER health_conditions_json'],
    ['surgery_details', 'VARCHAR(255) NULL AFTER surgery'],
    ['maintenance_medication', 'TINYINT(1) NULL AFTER surgery_details'],
    ['maintenance_medications', 'VARCHAR(255) NULL AFTER maintenance_medication'],
    ['signature_name', 'VARCHAR(191) NULL AFTER maintenance_medications'],
  ]

  const visitColumns = [
    ['temperature', 'VARCHAR(40) NULL AFTER concern'],
    ['height', 'VARCHAR(40) NULL AFTER temperature'],
    ['weight', 'VARCHAR(40) NULL AFTER height'],
    ['blood_pressure', 'VARCHAR(40) NULL AFTER weight'],
    ['respiratory_rate', 'VARCHAR(40) NULL AFTER blood_pressure'],
    ['pulse_rate', 'VARCHAR(40) NULL AFTER respiratory_rate'],
    ['oxygen_saturation', 'VARCHAR(40) NULL AFTER pulse_rate'],
    ['signs_symptoms', 'TEXT NULL AFTER oxygen_saturation'],
    ['visit_remarks', 'TEXT NULL AFTER signs_symptoms'],
    ['medication_first_aid', 'TEXT NULL AFTER visit_remarks'],
    ['medication_remarks', 'TEXT NULL AFTER medication_first_aid'],
    ['sent_home', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER discharged_at'],
    ['sent_home_date', 'DATE NULL AFTER sent_home'],
    ['sent_home_time', 'TIME NULL AFTER sent_home_date'],
    ['attending_physician', 'VARCHAR(191) NULL AFTER sent_home_time'],
  ]

  for (const [column, definition] of patientColumns) {
    if (!(await columnExists(connection, 'patient_records', column))) {
      await connection.execute(`ALTER TABLE patient_records ADD COLUMN ${column} ${definition}`)
    }
  }

  for (const [column, definition] of visitColumns) {
    if (!(await columnExists(connection, 'visits', column))) {
      await connection.execute(`ALTER TABLE visits ADD COLUMN ${column} ${definition}`)
    }
  }

  await connection.execute(
    `CREATE TABLE IF NOT EXISTS import_history (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      resource VARCHAR(80) NOT NULL,
      file_name VARCHAR(255) NULL,
      total_records INT UNSIGNED NOT NULL DEFAULT 0,
      imported_records INT UNSIGNED NOT NULL DEFAULT 0,
      failed_records INT UNSIGNED NOT NULL DEFAULT 0,
      duplicate_records INT UNSIGNED NOT NULL DEFAULT 0,
      imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY import_history_user_index (user_id),
      KEY import_history_resource_index (resource),
      CONSTRAINT import_history_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE SET NULL
    )`
  )
}

export async function parsePatientImportFile(file) {
  try {
    const workbook = xlsx.readFile(file.path, { cellDates: true, WTF: false })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return { records: [], errors: [] }

    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false })
    const errors = []

    if (!hasRequiredColumns(rawRows)) {
      errors.push(createFieldError(1, 'headers', `Required columns: ${PATIENT_IMPORT_REQUIRED_FIELDS.join(', ')}.`))
    }

    if (rawRows.length > maxRows) {
      errors.push(createFieldError(0, 'file', `Import files are limited to ${maxRows} rows.`))
    }

    const records = rawRows
      .slice(0, maxRows)
      .map((row, index) => ({ row, rowNumber: index + 2 }))
      .filter(({ row }) => !isEmptyImportRow(row))
      .filter(({ row }) => !isVisitHistoryDateRow(row))
      .map(({ row, rowNumber }) => normalizeImportRow(row, rowNumber))

    return { records, errors }
  } finally {
    await fs.rm(file.path, { force: true })
  }
}

export async function previewPatientImport(file) {
  const { records, errors } = await parsePatientImportFile(file)
  await ensurePatientImportSchema()
  const existingIds = await getExistingPatientIds()
  const existingVisitSignatures = await getExistingVisitSignatures()
  const rows = buildImportPreview(records, existingIds, existingVisitSignatures)
  const allErrors = [
    ...errors,
    ...rows.flatMap((row) => row.errors || []),
  ]

  return {
    requiredFields: PATIENT_IMPORT_REQUIRED_FIELDS,
    rows,
    errors: allErrors,
    summary: summarizePreviewRows(rows),
  }
}

async function recordImportHistory(connection, { userId, fileName, summary }) {
  await connection.execute(
    `INSERT INTO import_history
     (user_id, resource, file_name, total_records, imported_records, failed_records, duplicate_records)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      'patient_records',
      fileName || null,
      summary.total,
      summary.imported,
      summary.failed,
      summary.duplicates,
    ]
  )
}

async function createImportedVisit(connection, row, patientRecordId) {
  if (!patientRecordId) return false

  const visitDateTime = row.visitDateTime || toMysqlDateTime(new Date())
  const timestamp = new Date(visitDateTime).getTime() || Date.now()

  const [result] = await connection.execute(
    `INSERT INTO visits
     (patient_record_id, name, position, department, student_id, employee_id, course,
      year_level, section, concern, temperature, height, weight, blood_pressure,
      respiratory_rate, pulse_rate, oxygen_saturation, signs_symptoms, visit_remarks,
      medication_first_aid, medication_remarks, visit_datetime, discharged_at,
      sent_home, sent_home_date, sent_home_time, attending_physician, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patientRecordId,
      row.name,
      row.role || 'Student',
      toNullableString(row.department),
      row.studentId || null,
      row.employeeId || null,
      toNullableString(row.course),
      toNullableString(row.yearLevel),
      toNullableString(row.section),
      toNullableString(row.concern) || 'General check-up',
      toNullableString(row.temperature),
      toNullableString(row.height),
      toNullableString(row.weight),
      toNullableString(row.bloodPressure),
      toNullableString(row.respiratoryRate),
      toNullableString(row.pulseRate),
      toNullableString(row.oxygenSaturation),
      toNullableString(row.signsSymptoms),
      toNullableString(row.visitRemarks),
      toNullableString(row.medicationFirstAid),
      toNullableString(row.medicationRemarks),
      visitDateTime,
      row.dischargedAt || null,
      row.sentHome || 0,
      row.sentHomeDate || null,
      row.sentHomeTime || null,
      toNullableString(row.attendingPhysician),
      timestamp,
    ]
  )

  for (const medicineName of row.medicines || []) {
    const [medicineRows] = await connection.execute(
      'SELECT id FROM medicines WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [medicineName]
    )

    await connection.execute(
      'INSERT INTO visit_medicines (visit_id, medicine_id, medicine_name) VALUES (?, ?, ?)',
      [result.insertId, medicineRows[0]?.id || null, medicineName]
    )
  }

  return true
}

async function upsertImportedPatient(connection, row) {
  const recordId = row.studentId || row.employeeId
  const idColumn = row.studentId ? 'student_id' : 'employee_id'
  const values = [
    row.name,
    row.role || 'Student',
    toNullableString(row.department),
    toNullableString(row.course),
    toNullableString(row.yearLevel),
    toNullableString(row.section),
    row.birthdate || null,
    toNullableString(row.gender),
    toNullableString(row.placeOfBirth),
    toNullableString(row.fatherName),
    toNullableString(row.fatherOccupation),
    toNullableString(row.motherName),
    toNullableString(row.motherOccupation),
    toNullableString(row.contact),
    toNullableString(row.address),
    toNullableString(row.emergencyContactName),
    toNullableString(row.emergencyContactPhone),
    toNullableString(row.emergencyContactName2),
    toNullableString(row.emergencyContactPhone2),
    toNullableString(row.bloodType),
  ]

  const [patientRows] = await connection.execute(
    `SELECT * FROM patient_records WHERE ${idColumn} = ? LIMIT 1`,
    [recordId]
  )

  if (patientRows[0]) {
    if (!patientMatchesImportRow(patientRows[0], row)) {
      throw createPatientConflictError(patientRows[0], recordId)
    }

    await connection.execute(
      `UPDATE patient_records
       SET name = ?, position = ?, department = ?, course = ?, year_level = ?, section = ?,
           birthdate = ?, gender = ?, place_of_birth = ?, father_name = ?, father_occupation = ?,
           mother_name = ?, mother_occupation = ?, contact = ?, address = ?,
           emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_name_2 = ?,
           emergency_contact_phone_2 = ?, blood_type = ?
       WHERE id = ?`,
      [...values, patientRows[0].id]
    )
    return { id: patientRows[0].id, action: 'updated' }
  }

  const [result] = await connection.execute(
    `INSERT INTO patient_records
     (student_id, employee_id, name, position, department, course, year_level,
      section, birthdate, gender, place_of_birth, father_name, father_occupation,
      mother_name, mother_occupation, contact, address, emergency_contact_name,
      emergency_contact_phone, emergency_contact_name_2, emergency_contact_phone_2,
      blood_type, registered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.studentId || null,
      row.employeeId || null,
      row.name,
      row.role || 'Student',
      toNullableString(row.department),
      toNullableString(row.course),
      toNullableString(row.yearLevel),
      toNullableString(row.section),
      row.birthdate || null,
      toNullableString(row.gender),
      toNullableString(row.placeOfBirth),
      toNullableString(row.fatherName),
      toNullableString(row.fatherOccupation),
      toNullableString(row.motherName),
      toNullableString(row.motherOccupation),
      toNullableString(row.contact),
      toNullableString(row.address),
      toNullableString(row.emergencyContactName),
      toNullableString(row.emergencyContactPhone),
      toNullableString(row.emergencyContactName2),
      toNullableString(row.emergencyContactPhone2),
      toNullableString(row.bloodType),
      toMysqlDateTime(new Date()),
    ]
  )

  return { id: result.insertId, action: 'imported' }
}

export async function confirmPatientImport(rows, { userId, fileName } = {}) {
  return transaction(async (connection) => {
    await ensurePatientImportSchema(connection)
    const existingIds = await getExistingPatientIds(connection)
    const existingVisitSignatures = await getExistingVisitSignatures(connection)
    const previewRows = buildImportPreview(rows, existingIds, existingVisitSignatures)
    const importableRows = previewRows.filter((row) => isImportableStatus(row.status))
    const imported = []
    const updated = []
    let visitsCreated = 0

    for (const row of importableRows) {
      const patient = await upsertImportedPatient(connection, row)
      if (await createImportedVisit(connection, row, patient.id)) visitsCreated += 1

      if (patient.action === 'updated') {
        updated.push(row.studentId || row.employeeId)
      } else {
        existingIds.add(getRecordImportKey(row))
        imported.push(row.studentId || row.employeeId)
      }
    }

    const summary = {
      total: previewRows.length,
      imported: imported.length,
      updated: updated.length,
      visitsCreated,
      duplicates: previewRows.filter((row) => row.status === 'Duplicate').length,
      failed: previewRows.filter((row) => row.status === 'Invalid').length,
    }

    await recordImportHistory(connection, { userId, fileName, summary })

    return {
      rows: previewRows,
      summary,
      errors: previewRows.flatMap((row) => row.errors || []),
    }
  })
}
