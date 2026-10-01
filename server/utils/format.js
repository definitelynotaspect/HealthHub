export function toNullableString(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed || null
}

const departmentByCourse = {
  ACT: 'College of Information and Computer Studies',
  BSCS: 'College of Information and Computer Studies',
  BEED: 'College of Education',
  BSED: 'College of Education',
  BSA: 'College of Business and Accountancy',
  BSBA: 'College of Business and Accountancy',
  BSCRIM: 'College of Criminal Justice Education',
  BPA: 'College of Public Administration',
  BSPA: 'College of Public Administration',
  BSTM: 'College of Hospitality and Tourism Management',
}

// Some older records saved the course abbreviation in the department column.
// Keep the course untouched while returning and saving the corresponding college.
export function normalizeDepartment(department, course = '') {
  const value = String(department ?? '').trim()
  const mappedDepartment = departmentByCourse[String(course ?? '').trim().toUpperCase()]
  return mappedDepartment && value.toUpperCase() in departmentByCourse ? mappedDepartment : value
}

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

function formatLocalMysqlDateTime(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-') + ' ' + [
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes()),
    padDatePart(date.getSeconds()),
  ].join(':')
}

function normalizeDateTimeString(value) {
  const trimmed = String(value ?? '').trim()
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return null

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/)
  if (!match) return null
  return `${match[1]} ${match[2]}:${match[3] || '00'}`
}

function formatLocalApiDateTime(date) {
  return formatLocalMysqlDateTime(date).replace(' ', 'T')
}

export function toMysqlDateTime(value) {
  if (!value) return null
  const localString = normalizeDateTimeString(value)
  if (localString) return localString

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return formatLocalMysqlDateTime(date)
}

export function fromMysqlDateTime(value) {
  if (!value) return null
  if (typeof value === 'string') return value.replace(' ', 'T')

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return formatLocalApiDateTime(date)
}

export function toMysqlDate(value) {
  if (!value) return null
  const trimmed = String(value).trim()
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-')
}

export function fromMysqlDate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-')
}

function mapNullableBoolean(value) {
  if (value === null || value === undefined) return ''
  return Number(value) === 1 ? 'yes' : 'no'
}

function parseJsonArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getInitials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function mapPatient(row) {
  return {
    id: row.id,
    studentId: row.student_id || '',
    employeeId: row.employee_id || '',
    name: row.name || '',
    lastName: row.last_name || '',
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    position: row.position || 'Student',
    department: normalizeDepartment(row.department, row.course),
    course: row.course || '',
    yearLevel: row.year_level || '',
    section: row.section || '',
    birthdate: fromMysqlDate(row.birthdate),
    gender: row.gender || '',
    placeOfBirth: row.place_of_birth || '',
    fatherName: row.father_name || '',
    fatherOccupation: row.father_occupation || '',
    motherName: row.mother_name || '',
    motherOccupation: row.mother_occupation || '',
    email: row.email || '',
    contact: row.contact || '',
    address: row.address || '',
    emergencyContactName: row.emergency_contact_name || '',
    emergencyContactPhone: row.emergency_contact_phone || '',
    emergencyContactName2: row.emergency_contact_name_2 || '',
    emergencyContactPhone2: row.emergency_contact_phone_2 || '',
    bloodType: row.blood_type || '',
    completeImmunization: mapNullableBoolean(row.complete_immunization),
    missedImmunization: row.missed_immunization || '',
    medicalCondition: mapNullableBoolean(row.medical_condition),
    medicalConditionDetails: row.medical_condition_details || '',
    hospitalized: mapNullableBoolean(row.hospitalized),
    hospitalizationDetails: row.hospitalization_details || '',
    allergy: mapNullableBoolean(row.allergy),
    allergyDetails: row.allergy_details || '',
    covidVaccination: mapNullableBoolean(row.covid_vaccination),
    covidFirstDose: fromMysqlDate(row.covid_first_dose),
    covidSecondDose: fromMysqlDate(row.covid_second_dose),
    covidBooster1: fromMysqlDate(row.covid_booster_1),
    covidBooster2: fromMysqlDate(row.covid_booster_2),
    healthConditions: parseJsonArray(row.health_conditions_json),
    surgery: mapNullableBoolean(row.surgery),
    surgeryDetails: row.surgery_details || '',
    maintenanceMedication: mapNullableBoolean(row.maintenance_medication),
    maintenanceMedications: row.maintenance_medications || '',
    signatureName: row.signature_name || '',
    registeredAt: fromMysqlDateTime(row.registered_at),
    createdAt: fromMysqlDateTime(row.created_at),
    updatedAt: fromMysqlDateTime(row.updated_at),
  }
}

export function mapMedicine(row) {
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity) || 0,
    image: row.image || '',
    hasImage: Boolean(row.has_image ?? row.image),
    imageLoaded: Boolean(row.image),
    description: row.description || '',
    category: row.category || 'General medicine',
    createdAt: fromMysqlDateTime(row.created_at),
    updatedAt: fromMysqlDateTime(row.updated_at),
  }
}

function cleanVisitMedicineName(value) {
  return String(value ?? '')
    .replace(/^(?:\/?\s*)?(?:medication\s*\/?\s*)?first\s*aid\s*provided\s*(?:remarks)?\s*/i, '')
    .replace(/^remarks\s*/i, '')
    .trim()
}

function normalizeVisitMedicineList(value) {
  return String(value ?? '')
    .split(/\s*(?:\|\||\/|,|\r?\n)\s*/)
    .map((item) => {
      const value = cleanVisitMedicineName(item)
      const quantityMatch = value.match(/^(.*?)::(\d+)$/)
      if (!quantityMatch) return value

      const name = quantityMatch[1].trim()
      const quantity = Math.max(1, Number(quantityMatch[2]) || 1)
      return quantity > 1 ? `${name} x${quantity}` : name
    })
    .filter(Boolean)
}

export function mapVisit(row) {
  const medicines = normalizeVisitMedicineList(row.medicines || row.medication_first_aid)
  const majorComplaint = row.signs_symptoms || row.concern || 'General check-up'

  return {
    id: row.id,
    patientRecordId: row.patient_record_id,
    initials: getInitials(row.name),
    name: row.name || '',
    position: row.position || 'Student',
    department: normalizeDepartment(row.department, row.course),
    studentId: row.student_id || '',
    employeeId: row.employee_id || '',
    course: row.course || '',
    yearLevel: row.year_level || '',
    section: row.section || '',
    concern: majorComplaint,
    temperature: row.temperature || '',
    height: row.height || '',
    weight: row.weight || '',
    bloodPressure: row.blood_pressure || '',
    respiratoryRate: row.respiratory_rate || '',
    pulseRate: row.pulse_rate || '',
    oxygenSaturation: row.oxygen_saturation || '',
    signsSymptoms: row.signs_symptoms || '',
    clinicVisitRemarks: row.clinic_visit_remarks || '',
    visitRemarks: row.visit_remarks || '',
    medicationFirstAid: row.medication_first_aid || '',
    medicationRemarks: row.medication_remarks || '',
    medicines,
    visitDateTime: fromMysqlDateTime(row.visit_datetime),
    dischargedAt: fromMysqlDateTime(row.discharged_at),
    sentHome: Boolean(row.sent_home),
    sentHomeDate: fromMysqlDate(row.sent_home_date),
    sentHomeTime: row.sent_home_time || '',
    attendingPhysician: row.attending_physician || '',
    sentHomeEmailSentAt: fromMysqlDateTime(row.sent_home_email_sent_at),
    sentHomeEmailError: row.sent_home_email_error || '',
    timestamp: row.timestamp ? Number(row.timestamp) : new Date(row.visit_datetime || row.created_at).getTime(),
    tone: row.discharged_at ? 'green' : 'red',
    createdAt: fromMysqlDateTime(row.created_at),
    updatedAt: fromMysqlDateTime(row.updated_at),
  }
}
