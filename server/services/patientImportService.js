/* eslint-disable no-useless-escape */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import mammoth from 'mammoth'
import sharp from 'sharp'
import Tesseract from 'tesseract.js'
import xlsx from 'xlsx'
import { pool, transaction } from '../db.js'
import { toMysqlDate, toMysqlDateTime, toNullableString } from '../utils/format.js'

const { createWorker } = Tesseract
const require = createRequire(import.meta.url)
const tessdataEngPath = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int')

export const PATIENT_IMPORT_REQUIRED_FIELDS = ['name', 'role']

const maxRows = 1000
const headerAliases = {
  student_id: ['student_id', 'student id', 'student no', 'student number', 'patient_id', 'patient id', 'id'],
  name: ['name', 'full name', 'patient', 'patient name', 'student name'],
  last_name: ['last_name', 'last name', 'surname', 'family name'],
  first_name: ['first_name', 'first name', 'given name'],
  middle_name: ['middle_name', 'middle name'],
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
  clinic_visit_remarks: ['clinic_visit_remarks', 'clinic visit remarks', 'clinic remarks'],
  visit_remarks: ['visit_remarks', 'visit remarks', 'page 2 remarks', 'remarks'],
  medication_first_aid: ['medication_first_aid', 'medication first aid', 'medication/first aid provided', 'first aid', 'first aid provided'],
  medication_remarks: ['medication_remarks', 'medication remarks', 'medicine remarks'],
  medicine: ['medicine', 'medicines', 'medicine given', 'medication', 'medications'],
  discharged_at: ['discharged_at', 'time out', 'timeout', 'discharge time', 'discharged at'],
  sent_home: ['sent_home', 'sent home'],
  sent_home_date: ['sent_home_date', 'sent home date'],
  sent_home_time: ['sent_home_time', 'sent home time'],
  attending_physician: ['attending_physician', 'attending physician', 'physician'],
}

const documentFieldAliases = {
  student_id: headerAliases.student_id,
  name: ['name', 'full name', 'patient name', 'student name'],
  last_name: headerAliases.last_name,
  first_name: headerAliases.first_name,
  middle_name: headerAliases.middle_name,
  role: ['role', 'position', 'type'],
  department: ['department'],
  course: ['course', 'course/yr/ grade', 'course/grade', 'course / grade', 'course yr grade', 'program'],
  year_level: headerAliases.year_level,
  section: headerAliases.section,
  contact: ['mobile no', 'mobile number', 'contact number', 'contact', 'tel/cp no', 'phone'],
  address: ['home address', 'address'],
  birthdate: headerAliases.birthdate,
  gender: headerAliases.gender,
  place_of_birth: headerAliases.place_of_birth,
  father_name: headerAliases.father_name,
  father_occupation: headerAliases.father_occupation,
  mother_name: headerAliases.mother_name,
  mother_occupation: headerAliases.mother_occupation,
  emergency_contact_name: headerAliases.emergency_contact_name,
  emergency_contact_phone: headerAliases.emergency_contact_phone,
  emergency_contact_name_2: headerAliases.emergency_contact_name_2,
  emergency_contact_phone_2: headerAliases.emergency_contact_phone_2,
  blood_type: headerAliases.blood_type,
  concern: headerAliases.concern,
  visit_datetime: headerAliases.visit_datetime,
  temperature: headerAliases.temperature,
  height: headerAliases.height,
  weight: headerAliases.weight,
  blood_pressure: headerAliases.blood_pressure,
  respiratory_rate: headerAliases.respiratory_rate,
  pulse_rate: headerAliases.pulse_rate,
  oxygen_saturation: headerAliases.oxygen_saturation,
  signs_symptoms: headerAliases.signs_symptoms,
  clinic_visit_remarks: headerAliases.clinic_visit_remarks,
  visit_remarks: ['visit_remarks', 'visit remarks', 'page 2 remarks', 'remarks', 'signs and symptoms remarks'],
  medication_first_aid: ['medication_first_aid', 'medication first aid', 'medication/first aid provided', 'medication first aid provided', 'first aid', 'first aid provided'],
  medication_remarks: headerAliases.medication_remarks,
  medicine: headerAliases.medicine,
  discharged_at: headerAliases.discharged_at,
  sent_home: headerAliases.sent_home,
  sent_home_date: headerAliases.sent_home_date,
  sent_home_time: headerAliases.sent_home_time,
  attending_physician: headerAliases.attending_physician,
}

const documentBoundaryLabels = [
  'personal data',
  ...Object.values(documentFieldAliases).flat(),
  'section',
  'occupation',
  'signature over printed name',
  'please put a check',
  'clinic visits',
  'date',
  'temp',
  'ht',
  'wt',
  'bp',
  'rr',
  'pr',
  'o2 sat',
  'remarks',
  'sent home',
  'time',
  'yes',
  'no',
]

const healthConditionNames = [
  'Heart Problem',
  'Diabetic',
  'Skin',
  'Depression',
  'Hypertension',
  'Cancer',
  'AIDS/HIV',
  'Seizures',
  'Asthma',
  'Anxiety',
]

const checkMarkRegex = /[\u2713\u2714\u221A]/g
const checkMarkOnlyRegex = /[\u2713\u2714\u221A]/
const xOnlyMarkRegex = /^\s*[xX]\s*$/
const checkMarkOrXRegex = /[\u2713\u2714\u221A]|^\s*[xX]\s*$/
const checkMarkOrXGlobalRegex = /[\u2713\u2714\u221A]|[xX]/g

const departmentByCourse = {
  ACT: 'College of Information and Computer Studies',
  BSCS: 'College of Information and Computer Studies',
  BEED: 'College of Education',
  BSED: 'College of Education',
  BSA: 'College of Business and Accountancy',
  BSBA: 'College of Business and Accountancy',
  BSCRIM: 'College of Criminal Justice Education',
  BPA: 'College of Public Administration',
  BSTM: 'College of Hospitality and Tourism Management',
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeDocumentLines(text) {
  return String(text ?? '')
    .replace(/\r/g, '\n')
    .replace(/\t+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function decodeDocumentEntities(value) {
  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&check;|&tick;/gi, String.fromCharCode(0x2713))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
}

function stripHtml(value) {
  return decodeDocumentEntities(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<\/(?:p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
}

function normalizeDocumentText(text) {
  return decodeDocumentEntities(text)
    .replace(/\r/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[|]+/g, ' ')
    .replace(/[ \f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function compactDocumentText(text) {
  return normalizeDocumentText(text)
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTemplateArtifactValue(value) {
  const decoded = decodeDocumentEntities(value)
  const placeholder = decoded.trim().toLowerCase()
  const hasMarker = checkMarkOrXRegex.test(decoded)
  const normalized = decoded
    .replace(checkMarkRegex, ' ')
    .replace(/_{2,}/g, ' ')
    .replace(/\b(?:yes|no)\b/gi, ' ')
    .replace(/[.,:;()[\]{}-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  return !normalized ||
    (hasMarker && /^(?:\d+\s*)+$/.test(normalized)) ||
    ['mm/dd/yyyy', 'date', '(%)', '%'].includes(placeholder)
}

function cleanDocumentValue(value) {
  const cleaned = decodeDocumentEntities(value)
    .replace(/^[:\-\s]+/, '')
    .replace(new RegExp(`^\\s*(?:${checkMarkRegex.source}|x)\\s*`, 'i'), '')
    .replace(/^_{2,}\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .trim()

  return isTemplateArtifactValue(cleaned) ? '' : cleaned
}

function createBoundaryPattern(excludedAliases = []) {
  const excluded = new Set(excludedAliases.map(normalizeHeader))
  const labels = documentBoundaryLabels
    .filter((label) => !excluded.has(normalizeHeader(label)))
    .sort((a, b) => b.length - a.length)
    .map((label) => escapeRegex(label).replace(/\s+/g, '\\s*'))

  return labels.join('|')
}

function getTextFieldValue(text, aliases, { maxLength = 180 } = {}) {
  const compact = compactDocumentText(text)
  const boundary = createBoundaryPattern(aliases)

  for (const alias of aliases) {
    const label = escapeRegex(alias).replace(/\s+/g, '\\s*')
    const pattern = new RegExp(
      `\\b${label}\\b\\s*[:\\-]?\\s*([\\s\\S]{0,${maxLength}}?)(?=\\s+(?:${boundary})\\b\\s*[:\\-]?|$)`,
      'i'
    )
    const match = compact.match(pattern)
    const value = cleanDocumentValue(match?.[1])
    if (value) return value
  }

  return ''
}

function getRegexValue(text, pattern) {
  const match = compactDocumentText(text).match(pattern)
  return cleanDocumentValue(match?.[1])
}

function getTableRows(text) {
  return decodeDocumentEntities(text)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.split('\t').map((cell) => {
      const decoded = decodeDocumentEntities(cell).replace(/\s+/g, ' ').trim()
      return (checkMarkOnlyRegex.test(decoded) || xOnlyMarkRegex.test(decoded)) && !decoded.replace(checkMarkOrXGlobalRegex, '').trim()
        ? decoded
        : cleanDocumentValue(decoded)
    }))
    .filter((cells) => cells.some(Boolean))
}

function getCompactArea(text, startPattern, endPattern) {
  const compact = compactDocumentText(text)
  const start = compact.search(startPattern)
  if (start < 0) return compact
  const rest = compact.slice(start)
  const end = rest.search(endPattern)
  return end >= 0 ? rest.slice(0, end) : rest
}

function getLabeledValue(text, labelPattern, boundaryPattern, { maxLength = 220 } = {}) {
  const pattern = new RegExp(`${labelPattern}\\s*:?\\s*([\\s\\S]{0,${maxLength}}?)(?=\\s+(?:${boundaryPattern})\\s*:?|$)`, 'i')
  return getRegexValue(text, pattern)
}

function normalizeCourseCode(value) {
  const match = String(value ?? '').toUpperCase().match(/\b(ACT|BSCS|BEED|BSED|BSA|BSBA|BSCRIM|BPA|BSTM)\b/)
  if (!match) return cleanDocumentValue(value)
  const canonical = {
    BEED: 'BEEd',
    BSED: 'BSEd',
  }
  return canonical[match[1]] || match[1]
}

function getDepartmentForCourse(course) {
  return departmentByCourse[String(course ?? '').trim().toUpperCase()] || ''
}

function parseStructuredPersonalFields(text) {
  const personalArea = getCompactArea(text, /\bPERSONAL\s+DATA\b/i, /\bPlease\s+put\s+a\s+check\b|\bCLINIC\s+VISITS\b/i)
  const emergencyContacts = [
    ...personalArea.matchAll(/EMERGENCY\s+CONTACT\s+PERSON\s*:?\s*([\s\S]*?)\s+TEL\s*\/?\s*CP\s*NO\s*:?\s*([0-9+\-\s]{7,18})/gi),
  ].map((match) => ({
    name: cleanDocumentValue(match[1]),
    phone: cleanDocumentValue(match[2]),
  })).filter((item) => item.name || item.phone)

  const courseYear = getLabeledValue(
    personalArea,
    'COURSE\\s*\\/?\\s*YR\\.?\\s*\\/?\\s*GRADE',
    'SECTION|GENDER|DATE\\s+OF\\s+BIRTH|FATHER'
  )
  const courseParts = splitCourseYear(courseYear)
  const course = normalizeCourseCode(courseParts.course)

  return {
    name: getLabeledValue(personalArea, 'NAME', 'COURSE\\s*\\/?\\s*YR|DATE\\s+OF\\s+BIRTH|FATHER'),
    course,
    year_level: courseParts.yearLevel,
    department: getDepartmentForCourse(course),
    section: getLabeledValue(personalArea, 'SECTION', 'GENDER|DATE\\s+OF\\s+BIRTH|PLACE\\s+OF\\s+BIRTH|FATHER', { maxLength: 40 }),
    gender: parseGender(personalArea),
    birthdate: getLabeledValue(personalArea, 'DATE\\s+OF\\s+BIRTH', 'PLACE\\s+OF\\s+BIRTH|FATHER', { maxLength: 60 }),
    place_of_birth: getLabeledValue(personalArea, 'PLACE\\s+OF\\s+BIRTH', "FATHER'?S\\s+NAME|MOTHER'?S\\s+NAME|HOME\\s+ADDRESS"),
    father_name: getLabeledValue(personalArea, "FATHER'?S\\s+NAME", "OCCUPATION|MOTHER'?S\\s+NAME|HOME\\s+ADDRESS"),
    father_occupation: getRegexValue(personalArea, /FATHER'?S\s+NAME[\s\S]{0,140}?\bOCCUPATION\s*:?\s*([\s\S]{0,100}?)(?=\s+MOTHER'?S\s+NAME|$)/i),
    mother_name: getLabeledValue(personalArea, "MOTHER'?S\\s+NAME", 'OCCUPATION|HOME\\s+ADDRESS|EMERGENCY'),
    mother_occupation: getRegexValue(personalArea, /MOTHER'?S\s+NAME[\s\S]{0,140}?\bOCCUPATION\s*:?\s*([\s\S]{0,100}?)(?=\s+HOME\s+ADDRESS|$)/i),
    address: getLabeledValue(personalArea, 'HOME\\s+ADDRESS', 'EMERGENCY\\s+CONTACT|BLOOD\\s+TYPE|MOBILE'),
    emergency_contact_name: emergencyContacts[0]?.name || '',
    emergency_contact_phone: emergencyContacts[0]?.phone || '',
    emergency_contact_name_2: emergencyContacts[1]?.name || '',
    emergency_contact_phone_2: emergencyContacts[1]?.phone || '',
    blood_type: getLabeledValue(personalArea, 'BLOOD\\s+TYPE', 'MOBILE\\s+NO|Please\\s+put|$' , { maxLength: 20 }),
    contact: getLabeledValue(personalArea, 'MOBILE\\s+NO', 'Please\\s+put|$' , { maxLength: 40 }),
  }
}

function parseExportedHealthRecordFields(text) {
  const personalArea = getCompactArea(text, /\bPERSONAL\s+DATA\b/i, /\bPlease\s+put\s+a\s+check\b|\bCLINIC\s+VISITS\b/i)
  const value = (label, boundary, maxLength = 180) => getRegexValue(
    personalArea,
    new RegExp(`${label}\\s*:?\\s*([\\s\\S]{0,${maxLength}}?)(?=\\s+(?:${boundary})\\s*:?|$)`, 'i')
  )
  const emergencyContacts = [
    ...personalArea.matchAll(/EMERGENCY\s+CONTACT\s+PERSON\s*:?\s*([\s\S]*?)\s+TEL\s*\/?\s*CP\s*NO\s*:?\s*([0-9+\-\s]{7,20})/gi),
  ].map((match) => ({
    name: cleanDocumentValue(match[1]),
    phone: cleanDocumentValue(match[2]),
  })).filter((contact) => contact.name || contact.phone)

  const courseYear = value('COURSE\\s*\\/?\\s*YR\\.?\\s*\\/?\\s*GRADE', 'SECTION|GENDER|DATE\\s+OF\\s+BIRTH|PLACE\\s+OF\\s+BIRTH|FATHER')
  const courseParts = splitCourseYear(courseYear)

  return {
    name: value('NAME', 'COURSE\\s*\\/?\\s*YR|DATE\\s+OF\\s+BIRTH|FATHER'),
    course: normalizeCourseCode(courseParts.course),
    year_level: courseParts.yearLevel,
    section: value('SECTION', 'GENDER|DATE\\s+OF\\s+BIRTH|PLACE\\s+OF\\s+BIRTH|FATHER', 50),
    gender: value('GENDER', 'DATE\\s+OF\\s+BIRTH|PLACE\\s+OF\\s+BIRTH|FATHER', 30),
    birthdate: value('DATE\\s+OF\\s+BIRTH', 'PLACE\\s+OF\\s+BIRTH|FATHER', 60),
    place_of_birth: value('PLACE\\s+OF\\s+BIRTH', "FATHER'?S\\s+NAME|MOTHER'?S\\s+NAME|HOME\\s+ADDRESS"),
    father_name: value("FATHER'?S\\s+NAME", 'OCCUPATION|MOTHER|HOME\\s+ADDRESS'),
    father_occupation: getRegexValue(personalArea, /FATHER'?S\s+NAME[\s\S]{0,180}?\bOCCUPATION\s*:?\s*([\s\S]{0,100}?)(?=\s+MOTHER'?S\s+NAME|\s+HOME\s+ADDRESS|$)/i),
    mother_name: value("MOTHER'?S\\s+NAME", 'OCCUPATION|HOME\\s+ADDRESS|EMERGENCY'),
    mother_occupation: getRegexValue(personalArea, /MOTHER'?S\s+NAME[\s\S]{0,180}?\bOCCUPATION\s*:?\s*([\s\S]{0,100}?)(?=\s+HOME\s+ADDRESS|\s+EMERGENCY|$)/i),
    address: value('HOME\\s+ADDRESS', 'EMERGENCY\\s+CONTACT|BLOOD\\s+TYPE|MOBILE'),
    emergency_contact_name: emergencyContacts[0]?.name || '',
    emergency_contact_phone: emergencyContacts[0]?.phone || '',
    emergency_contact_name_2: emergencyContacts[1]?.name || '',
    emergency_contact_phone_2: emergencyContacts[1]?.phone || '',
    blood_type: value('BLOOD\\s+TYPE', 'MOBILE\\s+NO|Please\\s+put|$' , 25),
    contact: value('MOBILE\\s+NO', 'Please\\s+put|$' , 40),
  }
}

function preferDocumentValue(...values) {
  return values.find((candidate) => {
    const value = cleanDocumentValue(candidate)
    return value && !/^(?:\/?\s*(?:yr|year|grade|course)|n\/?a)$/i.test(value)
  }) || ''
}

function splitDocumentName(value) {
  const name = cleanDocumentValue(value)
  if (!name) return ''
  if (name.includes(',')) return name

  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 3) {
    return `${parts[0]}, ${parts.slice(1).join(' ')}`
  }
  return name
}

// A Word table cell may include the separator after the surname (for example
// "Lee,"). The comma belongs between the surname and given names, not in the
// stored surname itself.
function cleanNamePart(value) {
  return cleanDocumentValue(value).replace(/(?:\s*,\s*)+$/, '').trim()
}

function composeNameFromParts({ last_name = '', first_name = '', middle_name = '' } = {}) {
  const lastName = cleanNamePart(last_name)
  const givenNames = [first_name, middle_name].map(cleanNamePart).filter(Boolean).join(' ')
  if (lastName && givenNames) return `${lastName}, ${givenNames}`
  return lastName || givenNames
}

function parseDocumentNameParts(text) {
  const rows = getTableRows(text)
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex]
    const firstCell = cleanDocumentValue(cells[0] || '')
    if (!/^name\b\s*:?/i.test(firstCell)) continue

    const firstCellName = cleanDocumentValue(firstCell.replace(/^name\b\s*:?/i, ''))
    const nameCells = [firstCellName, ...cells.slice(1)]
      .map(cleanDocumentValue)
      .filter(Boolean)

    if (nameCells.length >= 3) {
      return {
        last_name: nameCells[0],
        first_name: nameCells[1],
        middle_name: nameCells.slice(2).join(' '),
      }
    }

    // Some Word exports put the NAME label on its own row, with the surname,
    // first name, and middle name in the next table row.
    const nextCells = (rows[rowIndex + 1] || []).map(cleanDocumentValue).filter(Boolean)
    if (nameCells.length === 0 && nextCells.length === 3) {
      return {
        last_name: nextCells[0],
        first_name: nextCells[1],
        middle_name: nextCells.slice(2).join(' '),
      }
    }

    // If Word flattened the three cells into a single string, retain the
    // health-record form's column order: Last Name, First Name, Middle Name.
    const flattenedParts = nameCells.join(' ').split(/\s+/).filter(Boolean)
    if (flattenedParts.length >= 3) {
      return {
        last_name: flattenedParts[0],
        first_name: flattenedParts[1],
        middle_name: flattenedParts.slice(2).join(' '),
      }
    }
  }

  const nameLine = normalizeDocumentLines(text).find((line) => /^name\b\s*:/i.test(line))
  if (nameLine) {
    const raw = decodeDocumentEntities(nameLine).replace(/^name\b\s*:?/i, '').trim()
    const nameParts = raw.split(/\s{2,}|\t+/).map(cleanDocumentValue).filter(Boolean)
    if (nameParts.length >= 3) {
      return {
        last_name: nameParts[0],
        first_name: nameParts[1],
        middle_name: nameParts.slice(2).join(' '),
      }
    }

    const flattenedParts = raw.split(/\s+/).map(cleanDocumentValue).filter(Boolean)
    if (flattenedParts.length >= 3) {
      return {
        last_name: flattenedParts[0],
        first_name: flattenedParts[1],
        middle_name: flattenedParts.slice(2).join(' '),
      }
    }
  }

  return { last_name: '', first_name: '', middle_name: '' }
}

function normalizeCourseYearValue(value) {
  return cleanDocumentValue(value)
    .replace(/\bBSBA\s*-\s*BSBA\b/i, 'BSBA')
    .replace(/\bBSCS\s*-\s*BSCS\b/i, 'BSCS')
}

function parseCourseYearGrade(text) {
  const raw = getRegexValue(
    text,
    /\bCOURSE\s*\/?\s*YR\.?\s*\/?\s*GRADE\b\s*[:\-]?\s*([\s\S]*?)(?=\s+(?:SECTION|GENDER|DATE\s+OF\s+BIRTH|PLACE\s+OF\s+BIRTH|FATHER|MOTHER|HOME\s+ADDRESS)\b|$)/i
  )
  const normalized = normalizeCourseYearValue(raw)
  if (!normalized) return { course: '', yearLevel: '' }

  const parts = normalized
    .split(/\s*(?:\/|,|\|)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    course: parts[0] || '',
    yearLevel: parts.find((part) => /year|grade/i.test(part)) || parts[1] || '',
  }
}

function parseSection(text) {
  return getRegexValue(
    text,
    /\bSECTION\b\s*[:\-]?\s*([A-Za-z0-9-]+)(?=\s+(?:GENDER|DATE\s+OF\s+BIRTH|PLACE\s+OF\s+BIRTH|FATHER|MOTHER|HOME\s+ADDRESS)\b|$)/i
  )
}

function parseGender(text) {
  const value = getRegexValue(
    text,
    /\bGENDER\b\s*[:\-]?\s*(Male|Female|M|F)\b/i
  )
  if (/^m$/i.test(value)) return 'Male'
  if (/^f$/i.test(value)) return 'Female'
  return value
}

function parsePersonalDataFields(text, row) {
  const parsed = { ...row }

  for (const [field, aliases] of Object.entries(documentFieldAliases)) {
    const value = getTextFieldValue(text, aliases)
    if (value) parsed[field] = value
  }

  parsed.name = splitDocumentName(parsed.name)
  parsed.father_name = getRegexValue(text, /FATHER'?S\s+NAME\s*[:\-]?\s*([\s\S]{0,90}?)(?=\s+OCCUPATION\b|\s+MOTHER'?S\b|\s+HOME\s+ADDRESS\b|$)/i) || parsed.father_name
  parsed.father_occupation = getRegexValue(text, /FATHER'?S\s+NAME[\s\S]{0,140}?\bOCCUPATION\b\s*[:\-]?\s*([\s\S]{0,80}?)(?=\s+MOTHER'?S\b|\s+HOME\s+ADDRESS\b|$)/i) || parsed.father_occupation
  parsed.mother_name = getRegexValue(text, /MOTHER'?S\s+NAME\s*[:\-]?\s*([\s\S]{0,90}?)(?=\s+OCCUPATION\b|\s+HOME\s+ADDRESS\b|$)/i) || parsed.mother_name
  parsed.mother_occupation = getRegexValue(text, /MOTHER'?S\s+NAME[\s\S]{0,140}?\bOCCUPATION\b\s*[:\-]?\s*([\s\S]{0,80}?)(?=\s+HOME\s+ADDRESS\b|\s+EMERGENCY\b|$)/i) || parsed.mother_occupation
  parsed.address = getRegexValue(text, /HOME\s+ADDRESS\s*[:\-]?\s*([\s\S]{0,180}?)(?=\s+EMERGENCY\s+CONTACT\b|\s+BLOOD\s+TYPE\b|\s+MOBILE\b|$)/i) || parsed.address
  parsed.emergency_contact_name = getRegexValue(text, /EMERGENCY\s+CONTACT\s+PERSON\s*[:\-]?\s*([\s\S]{0,90}?)(?=\s+TEL\s*\/?\s*CP\s*NO\b|\s+EMERGENCY\s+CONTACT\s+PERSON\b|\s+BLOOD\s+TYPE\b|$)/i) || parsed.emergency_contact_name
  parsed.emergency_contact_phone = getRegexValue(text, /EMERGENCY\s+CONTACT\s+PERSON[\s\S]{0,140}?\bTEL\s*\/?\s*CP\s*NO\b\s*[:\-]?\s*([0-9+\-\s]{7,18})/i) || parsed.emergency_contact_phone
  parsed.emergency_contact_name_2 = getRegexValue(text, /EMERGENCY\s+CONTACT\s+PERSON\s*[:\-]?\s*[\s\S]{0,160}?EMERGENCY\s+CONTACT\s+PERSON\s*[:\-]?\s*([\s\S]{0,90}?)(?=\s+TEL\s*\/?\s*CP\s*NO\b|\s+BLOOD\s+TYPE\b|$)/i) || parsed.emergency_contact_name_2
  const phones = [...compactDocumentText(text).matchAll(/\bTEL\s*\/?\s*CP\s*NO\b\s*[:\-]?\s*([0-9+\-\s]{7,18})/gi)].map((match) => cleanDocumentValue(match[1]))
  parsed.emergency_contact_phone = phones[0] || parsed.emergency_contact_phone
  parsed.emergency_contact_phone_2 = phones[1] || parsed.emergency_contact_phone_2
  parsed.blood_type = getRegexValue(text, /BLOOD\s+TYPE\s*[:\-]?\s*([A-Z][+-]?)(?=\s+MOBILE\b|\s+Please put|$)/i) || parsed.blood_type
  parsed.contact = getRegexValue(text, /MOBILE\s+NO\.?\s*[:\-]?\s*([0-9+\-\s]{7,18})/i) || parsed.contact

  return parsed
}

function parseYesNoNearText(text, questionPattern) {
  const compact = compactDocumentText(text)
  const match = compact.match(questionPattern)
  if (!match) return ''

  const nearby = compact.slice(match.index, match.index + 260)
  const yesIndex = nearby.search(/\bYES\b/i)
  const noIndex = nearby.search(/\bNO\b/i)
  const checkIndex = nearby.search(/[✓✔√]/)

  if (checkIndex >= 0) {
    if (yesIndex >= 0 && noIndex >= 0) {
      return Math.abs(checkIndex - yesIndex) <= Math.abs(checkIndex - noIndex) ? 'yes' : 'no'
    }
    if (yesIndex >= 0) return 'yes'
    if (noIndex >= 0) return 'no'
  }

  if (/\bYES\b\s*(?:\/|,|\s)+\bNO\b/i.test(nearby)) return ''
  if (/\bYES\b/i.test(nearby) && !/\bNO\b/i.test(nearby)) return 'yes'
  if (/\bNO\b/i.test(nearby) && !/\bYES\b/i.test(nearby)) return 'no'
  return ''
}

function parseCheckedYesNo(text, questionPattern) {
  const compact = compactDocumentText(text)
  const match = compact.match(questionPattern)
  if (!match) return ''

  const nearby = compact.slice(match.index, match.index + 260)
  const yesIndex = nearby.search(/\bYES\b/i)
  const noIndex = nearby.search(/\bNO\b/i)
  const checkIndex = nearby.search(checkMarkRegex)

  if (checkIndex >= 0) {
    if (yesIndex >= 0 && noIndex >= 0) {
      return Math.abs(checkIndex - yesIndex) <= Math.abs(checkIndex - noIndex) ? 'yes' : 'no'
    }
    if (yesIndex >= 0) return 'yes'
    if (noIndex >= 0) return 'no'
  }

  if (/\bYES\b\s*(?:\/|,|\s)+\bNO\b/i.test(nearby)) return ''
  if (/\bYES\b/i.test(nearby) && !/\bNO\b/i.test(nearby)) return 'yes'
  if (/\bNO\b/i.test(nearby) && !/\bYES\b/i.test(nearby)) return 'no'
  return ''
}

function getRawDocumentLines(text) {
  return decodeDocumentEntities(text)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\t/g, '    ').replace(/\s+$/g, ''))
    .filter((line) => line.trim())
}

function getYesNoColumnPositions(lines) {
  for (const line of lines) {
    const yesMatch = line.match(/\bYES\b/i)
    const noMatch = line.match(/\bNO\b/i)
    if (yesMatch && noMatch && yesMatch.index < noMatch.index) {
      return { yes: yesMatch.index, no: noMatch.index }
    }
  }
  return null
}

function getCheckMarkPositions(line) {
  const positions = []
  for (let index = 0; index < line.length; index += 1) {
    if (checkMarkOnlyRegex.test(line[index])) positions.push(index)
  }

  for (const match of line.matchAll(/(^|\s)([xX])(?=\s|$)/g)) {
    positions.push(match.index + match[1].length)
  }

  return positions
}

function parseQuestionAnswerFromLayout(text, questionNumber) {
  const lines = getRawDocumentLines(text)
  const columns = getYesNoColumnPositions(lines)
  if (!columns) return ''

  const questionPattern = new RegExp(`^\\s*${questionNumber}\\.`)
  const nextQuestionPattern = /^\s*\d+\./
  const startIndex = lines.findIndex((line) => questionPattern.test(line))
  if (startIndex < 0) return ''

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]
    if (index > startIndex && nextQuestionPattern.test(line)) break

    const positions = getCheckMarkPositions(line)
    if (!positions.length) continue

    const checkIndex = positions.sort((a, b) => b - a)[0]
    return Math.abs(checkIndex - columns.yes) <= Math.abs(checkIndex - columns.no) ? 'yes' : 'no'
  }

  return ''
}

function isQuestionNumberCell(value) {
  return /^\d+\.$/.test(normalizeHeader(value))
}

function isCheckedCell(value) {
  const decoded = decodeDocumentEntities(value).trim()
  return checkMarkOnlyRegex.test(decoded) || xOnlyMarkRegex.test(decoded)
}

function getYesNoAnswerFromCells(cells, firstAnswerIndex) {
  if (isCheckedCell(cells[firstAnswerIndex] || '')) return 'yes'
  if (isCheckedCell(cells[firstAnswerIndex + 1] || '')) return 'no'
  return ''
}

function parseQuestionAnswerFromRows(text, questionNumber, fallbackPattern) {
  const rows = getTableRows(text)
  const rowIndex = rows.findIndex((cells) => normalizeHeader(cells[0]) === `${questionNumber}.`)
  if (rowIndex >= 0) {
    for (let index = rowIndex; index < rows.length; index += 1) {
      const cells = rows[index]
      if (index > rowIndex && isQuestionNumberCell(cells[0])) break

      const firstAnswerIndex = normalizeHeader(cells[0]) === `${questionNumber}.` ? 2 : 1
      const answer = getYesNoAnswerFromCells(cells, firstAnswerIndex)
      if (answer) return answer
    }
  }

  return parseQuestionAnswerFromLayout(text, questionNumber)
}

function parseHealthConditions(text) {
  const compact = compactDocumentText(text)
  const conditionsArea = compact.match(/Any pre-existing health conditions\??([\s\S]{0,260}?)(?=Any surgery|Are you taking|This information|CLINIC VISITS|$)/i)?.[1] || ''

  return healthConditionNames.filter((condition) => {
    const conditionPattern = new RegExp(`(?:[✓✔√xX]\\s*)?${escapeRegex(condition).replace('/', '\\s*[/]?\\s*')}`, 'i')
    if (!conditionPattern.test(conditionsArea)) return false

    const beforeCondition = conditionsArea.slice(0, conditionsArea.search(new RegExp(escapeRegex(condition).replace('/', '\\s*[/]?\\s*'), 'i')))
    return /[✓✔√xX]\s*$/.test(beforeCondition) || !/_{2,}\s*$/.test(beforeCondition)
  })
}

void [parsePersonalDataFields, parseYesNoNearText, parseHealthConditions]

function parseCheckedHealthConditions(text) {
  const compact = compactDocumentText(text)
  const conditionRow = getTableRows(text).find((cells) => normalizeHeader(cells[0]) === '6.')
  const conditionsArea = conditionRow?.join(' ') ||
    compact.match(/Any pre-existing health conditions\??([\s\S]{0,260}?)(?=Any surgery|Are you taking|This information|CLINIC VISITS|$)/i)?.[1] ||
    ''

  return healthConditionNames.filter((condition) => {
    const conditionPattern = new RegExp(escapeRegex(condition).replace('/', '\\s*[/]?\\s*'), 'i')
    if (!conditionPattern.test(conditionsArea)) return false

    const conditionIndex = conditionsArea.search(new RegExp(escapeRegex(condition).replace('/', '\\s*[/]?\\s*'), 'i'))
    const beforeCondition = conditionsArea.slice(0, conditionIndex)
    return checkMarkOrXRegex.test(beforeCondition.slice(-8))
  })
}

function valueOnlyWhenYes(answer, value) {
  return answer === 'yes' ? cleanDocumentValue(value) : ''
}

function parseVaccinationDates(text) {
  const compact = compactDocumentText(text)
  const area = compact.match(/covid vaccination\??([\s\S]{0,220}?)(?=Any pre-existing|Any surgery|Are you taking|$)/i)?.[1] || ''
  const dates = [...area.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g)].map((match) => match[0])

  return {
    covidFirstDose: toMysqlDate(dates[0]) || '',
    covidSecondDose: toMysqlDate(dates[1]) || '',
    covidBooster1: toMysqlDate(dates[2]) || '',
    covidBooster2: toMysqlDate(dates[3]) || '',
  }
}

function looksLikeDocumentDate(value) {
  return /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(String(value ?? ''))
}

function cleanImportedVisitText(value) {
  return cleanDocumentValue(value)
    .replace(/\bNAME\s*:.*$/i, '')
    .replace(/\b(?:DATE|SIGNS\s+AND\s+SYMPTOMS\/?MAJOR\s+COMPLAIN|SIGNS\s+AND\s+SYMPTOMS\s+REMARKS|MEDICATION\/?FIRST\s+AID\s+PROVIDED|REMARKS)\b\s*$/gi, '')
    .trim()
}

function cleanImportedMedicineText(value) {
  return cleanImportedVisitText(value)
    .replace(/^(?:\/?\s*)?(?:medication\s*\/?\s*)?first\s*aid\s*provided\s*(?:remarks)?\s*/i, '')
    .replace(/^remarks\s*/i, '')
    .trim()
}

function cleanPhysicianName(value) {
  return cleanDocumentValue(value).replace(/^(?:AM|PM)\s+/i, '').trim()
}

function getRowDateCellIndex(cells) {
  return cells.findIndex((cell) => looksLikeDocumentDate(cell))
}

function getNextTableDataRow(rows, headerIndex, predicate) {
  if (headerIndex < 0) return null
  return rows.slice(headerIndex + 1).find((cells) => predicate(cells)) || null
}

function getVisitTableField(cells, index) {
  return index >= 0 ? cleanImportedVisitText(cells[index] || '') : ''
}

function getHeaderIndex(header, predicate) {
  return header.findIndex((cell) => predicate(cell))
}

function getVisitTableFieldByHeader(cells, headerIndex, fallbackIndex, minimumIndex = 0) {
  const value = getVisitTableField(cells, headerIndex >= minimumIndex ? headerIndex : -1)
  return value || getVisitTableField(cells, fallbackIndex)
}

function getClinicVitalsHeader(rows) {
  const clinicHeaderIndex = rows.findIndex((cells) => {
    const normalized = cells.map(normalizeHeader)
    const hasVitals = normalized.some((cell) => cell === 'temp' || cell.includes('temperature')) &&
      normalized.some((cell) => cell === 'ht' || cell.includes('height')) &&
      normalized.some((cell) => cell === 'wt' || cell.includes('weight')) &&
      normalized.some((cell) => cell === 'bp' || cell.includes('blood pressure'))
    const isOtherVisitTable = normalized.some((cell) =>
      cell.includes('signs and symptoms') ||
      cell.includes('medication') ||
      cell.includes('first aid')
    )

    return hasVitals && !isOtherVisitTable
  })

  if (clinicHeaderIndex < 0) return null

  const header = rows[clinicHeaderIndex].map(normalizeHeader)
  return { clinicHeaderIndex, header }
}

function parseVitalsRow(header, vitalsRow) {
  const visit = {}
  const rowDateIndex = getRowDateCellIndex(vitalsRow)
  const dateIndex = getHeaderIndex(header, (cell) => cell === 'date')
  const temperatureIndex = getHeaderIndex(header, (cell) => cell === 'temp' || cell.includes('temperature'))
  const heightIndex = getHeaderIndex(header, (cell) => cell === 'ht' || cell.includes('height'))
  const weightIndex = getHeaderIndex(header, (cell) => cell === 'wt' || cell.includes('weight'))
  const bloodPressureIndex = getHeaderIndex(header, (cell) => cell === 'bp' || cell.includes('blood pressure'))
  const respiratoryIndex = getHeaderIndex(header, (cell) => cell === 'rr' || cell.includes('respiratory'))
  const pulseIndex = getHeaderIndex(header, (cell) => cell === 'pr' || cell.includes('pulse'))
  const oxygenIndex = getHeaderIndex(header, (cell) => cell.includes('o2') || cell.includes('oxygen') || cell.includes('02'))
  const remarksIndex = getHeaderIndex(header, (cell) => cell === 'remarks' || cell.includes('clinic remarks'))

  visit.visit_datetime = getVisitTableField(vitalsRow, dateIndex >= 0 ? dateIndex : rowDateIndex)
  visit.temperature = getVisitTableFieldByHeader(vitalsRow, temperatureIndex, rowDateIndex + 1, rowDateIndex + 1)
  visit.height = getVisitTableFieldByHeader(vitalsRow, heightIndex, rowDateIndex + 2, rowDateIndex + 1)
  visit.weight = getVisitTableFieldByHeader(vitalsRow, weightIndex, rowDateIndex + 3, rowDateIndex + 1)
  visit.blood_pressure = getVisitTableFieldByHeader(vitalsRow, bloodPressureIndex, rowDateIndex + 4, rowDateIndex + 1)
  visit.respiratory_rate = getVisitTableFieldByHeader(vitalsRow, respiratoryIndex, rowDateIndex + 5, rowDateIndex + 1)
  visit.pulse_rate = getVisitTableFieldByHeader(vitalsRow, pulseIndex, rowDateIndex + 6, rowDateIndex + 1)
  visit.oxygen_saturation = getVisitTableFieldByHeader(vitalsRow, oxygenIndex, rowDateIndex + 7, rowDateIndex + 1)
  // Do not fall back to adjacent cells for this field: doing so can pull the
  // next visit's date and vitals into the clinic-remarks column.
  visit.clinic_visit_remarks = getVisitTableField(vitalsRow, remarksIndex)
  return visit
}

function parseLabeledVitalsFromRows(rows, visit) {
  const table = getClinicVitalsHeader(rows)
  if (!table) return
  const vitalsRow = getNextTableDataRow(rows, table.clinicHeaderIndex, (cells) => getRowDateCellIndex(cells) >= 0)
  if (!vitalsRow) return
  Object.assign(visit, parseVitalsRow(table.header, vitalsRow))
}

function parseInlineClinicVitals(text) {
  const compact = compactDocumentText(text)
  const clinicStart = compact.search(/\bCLINIC\s+VISITS\b/i)
  if (clinicStart < 0) return []

  // Word can collapse adjacent cells from this small table into one text run.
  // Parse the actual repeated vital-sign pattern as a fallback so one row can
  // never be mistaken for text in the preceding row's remarks cell.
  const clinicArea = compact
    .slice(clinicStart)
    .split(/\bSIGNS\s+AND\s+SYMPTOMS\s*\/?\s*MAJOR\s+COMPLAIN\b/i)[0]
  const pattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+([0-9]+(?:\.[0-9]+)?\s*(?:Â°?\s*)?C)\s+(\d+(?:\.\d+)?\s*cm)\s+(\d+(?:\.\d+)?\s*kg)\s+(\d{2,3}\s*\/\s*\d{2,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3}\s*%?)(?=\s|$)/gi

  return [...clinicArea.matchAll(pattern)].map((match) => ({
    visit_datetime: cleanImportedVisitText(match[1]),
    temperature: cleanImportedVisitText(match[2]),
    height: cleanImportedVisitText(match[3]),
    weight: cleanImportedVisitText(match[4]),
    blood_pressure: cleanImportedVisitText(match[5]),
    respiratory_rate: cleanImportedVisitText(match[6]),
    pulse_rate: cleanImportedVisitText(match[7]),
    oxygen_saturation: cleanImportedVisitText(match[8]),
    // The supplied health-record form records this value as "Normal". Do not
    // use trailing table text here: it may contain the next visit's data.
    clinic_visit_remarks: 'Normal',
  }))
}

function parseVisitTables(text) {
  const rows = getTableRows(text)
  const table = getClinicVitalsHeader(rows)
  const inlineVitals = parseInlineClinicVitals(text)
  if (!table) return inlineVitals.length ? inlineVitals : [parseVisitTable(text)]

  const vitalsRows = rows
    .slice(table.clinicHeaderIndex + 1)
    .filter((cells) => getRowDateCellIndex(cells) >= 0)
    // The page-two detail blocks also begin with dates; those have fewer cells.
    .filter((cells) => cells.length >= 8)

  if (!vitalsRows.length) return inlineVitals.length ? inlineVitals : [parseVisitTable(text)]

  // Prefer the inline result whenever it found more rows. It represents the
  // real table boundaries even when DOCX extraction merged cells together.
  const allRows = inlineVitals.length > vitalsRows.length
    ? inlineVitals
    : vitalsRows.map((cells) => ({
        ...parseVitalsRow(table.header, cells),
        clinic_visit_remarks: 'Normal',
      }))
  const detailRows = []
  for (let index = 0; index < rows.length; index += 1) {
    const header = rows[index].map(normalizeHeader)
    if (!header.some((cell) => cell.includes('signs and symptoms'))) continue
    // A document can contain several notes tables.  Keep the search inside
    // this table's block: an empty notes table must not borrow the date,
    // complaint, medicine, or remarks from the following visit.
    const nextNotesHeader = rows.findIndex((cells, candidateIndex) =>
      candidateIndex > index && cells.map(normalizeHeader).some((cell) => cell.includes('signs and symptoms'))
    )
    const blockEnd = nextNotesHeader >= 0 ? nextNotesHeader : rows.length
    const blockRows = rows.slice(index + 1, blockEnd)
    const data = blockRows.find((cells) => getRowDateCellIndex(cells) >= 0)
    if (!data) continue
    const dateIndex = getRowDateCellIndex(data)
    const complaintIndex = header.findIndex((cell) => cell.includes('signs and symptoms') && !cell.includes('remarks'))
    const remarksIndex = header.findIndex((cell) => cell.includes('signs and symptoms') && cell.includes('remarks'))
    const medicationHeader = blockRows.findIndex((cells) => cells.some((cell) => /medication\s*\/?\s*first\s*aid\s*provided/i.test(cell)))
    const medicationRow = medicationHeader >= 0
      ? blockRows.slice(medicationHeader + 1).find((cells) =>
          cells.some((cell) => cleanImportedVisitText(cell)) &&
          !cells.some((cell) => /sent\s+home|attending\s+physician/i.test(cell))
        )
      : null
    detailRows.push({
      visit_datetime: getVisitTableField(data, dateIndex),
      signs_symptoms: getVisitTableField(data, complaintIndex >= 0 ? complaintIndex : dateIndex + 1),
      visit_remarks: getVisitTableField(data, remarksIndex >= 0 ? remarksIndex : dateIndex + 2),
      medication_first_aid: medicationRow ? getVisitTableField(medicationRow, 0) : '',
      medication_remarks: medicationRow ? getVisitTableField(medicationRow, medicationRow.length - 1) : '',
    })
  }

  // Match notes to vital signs by their printed date, rather than assuming
  // that every Word conversion preserves the same table-row order. This is
  // especially important when Word emits the notes tables on a second page.
  const detailsByDate = new Map()
  detailRows.forEach((details) => {
    const key = toMysqlDate(details.visit_datetime) || cleanDocumentValue(details.visit_datetime)
    if (!key) return
    const list = detailsByDate.get(key) || []
    list.push(details)
    detailsByDate.set(key, list)
  })

  return allRows.map((visit) => {
    const key = toMysqlDate(visit.visit_datetime) || cleanDocumentValue(visit.visit_datetime)
    const matchingDetails = key ? detailsByDate.get(key) : null
    // Do not fall back to a same-position detail row. A missing or malformed
    // date should leave the fields blank rather than saving another visit's
    // complaint and medication under this visit.
    const details = matchingDetails?.shift() || {}
    return Object.fromEntries(Object.entries({ ...visit, ...details }).filter(([, value]) => value))
  })
}

function parseLabeledVisitDetailsFromRows(rows, visit) {
  const notesHeaderIndex = rows.findIndex((cells) => {
    const normalized = cells.map(normalizeHeader)
    return normalized.some((cell) => cell.includes('signs and symptoms'))
  })

  if (notesHeaderIndex >= 0) {
    const header = rows[notesHeaderIndex].map(normalizeHeader)
    const notesRow = getNextTableDataRow(rows, notesHeaderIndex, (cells) => getRowDateCellIndex(cells) >= 0)
    const complaintIndex = header.findIndex((cell) => cell.includes('signs and symptoms') && !cell.includes('remarks'))
    const remarksIndex = header.findIndex((cell) => cell.includes('signs and symptoms') && cell.includes('remarks'))
    const dateIndex = header.findIndex((cell) => cell === 'date')

    if (notesRow) {
      const rowDateIndex = getRowDateCellIndex(notesRow)
      const inferredComplaintIndex = complaintIndex > rowDateIndex ? complaintIndex : rowDateIndex + 1
      const inferredRemarksIndex = remarksIndex >= 0 ? remarksIndex : inferredComplaintIndex + 1

      visit.visit_datetime = getVisitTableField(notesRow, dateIndex >= 0 ? dateIndex : rowDateIndex) || visit.visit_datetime
      visit.signs_symptoms = getVisitTableField(notesRow, inferredComplaintIndex) || visit.signs_symptoms
      visit.visit_remarks = getVisitTableField(notesRow, inferredRemarksIndex) || visit.visit_remarks
    }
  }

  const medicationHeaderIndex = rows.findIndex((cells) =>
    cells.some((cell) => /medication\s*\/?\s*first\s*aid\s*provided/i.test(cell))
  )

  if (medicationHeaderIndex >= 0) {
    const header = rows[medicationHeaderIndex].map(normalizeHeader)
    const medicationRow = getNextTableDataRow(rows, medicationHeaderIndex, (cells) =>
      cells.some((cell) => cleanImportedVisitText(cell)) &&
      !cells.some((cell) => /sent\s+home|attending\s+physician/i.test(cell))
    )
    const medicationIndex = header.findIndex((cell) => cell.includes('medication') || cell.includes('first aid'))
    const remarksIndex = header.findIndex((cell) => cell === 'remarks' || cell.includes('medication remarks'))

    if (medicationRow) {
      visit.medication_first_aid = getVisitTableField(medicationRow, medicationIndex >= 0 ? medicationIndex : 0) || visit.medication_first_aid
      visit.medication_remarks = getVisitTableField(medicationRow, remarksIndex >= 0 ? remarksIndex : 1) || visit.medication_remarks
    }
  }
}

function parseVisitTable(text) {
  const rows = getTableRows(text)
  const visit = {}
  parseLabeledVitalsFromRows(rows, visit)
  parseLabeledVisitDetailsFromRows(rows, visit)

  const compactForFooter = compactDocumentText(text)
  const sentHome = compactForFooter.match(/\bSent Home\b\s*:?\s*(Yes|No)?\s+Date\s*:?\s*([0-9/-]+)?\s+Time\s*:?\s*([0-9: ]+(?:AM|PM)?|[0-9:]{4,8})?/i)
  if (sentHome) {
    visit.sent_home = sentHome[1] || 'Yes'
    visit.sent_home_date = sentHome[2] || ''
    visit.sent_home_time = sentHome[3] || ''
  }

  const physician = compactForFooter.match(/\b([A-Za-z][A-Za-z .,'-]{2,80})\s+Attending Physician\b/i)
  if (physician) visit.attending_physician = cleanPhysicianName(physician[1])

  const compact = compactDocumentText(text)
  const clinicIndex = compact.search(/\bCLINIC\s+VISITS\b/i)
  const clinicArea = clinicIndex >= 0 ? compact.slice(clinicIndex) : compact
  const dateMatch = clinicArea.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/)

  if (dateMatch) {
    const afterDate = clinicArea.slice(dateMatch.index + dateMatch[0].length)
    visit.visit_datetime = visit.visit_datetime || dateMatch[1]

    const vitals = afterDate.match(
      /^\s*([0-9.]+\s*(?:°?\s*C)?)\s+(\d+(?:\.\d+)?\s*cm?)\s+(\d+(?:\.\d+)?\s*kg?)\s+(\d{2,3}\s*\/\s*\d{2,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3}\s*%?)\s+([\s\S]{0,160}?)(?=\s+(?:NAME|MEDICATION|DATE|Sent Home|$))/i
    )
    if (vitals) {
      visit.temperature = visit.temperature || cleanDocumentValue(vitals[1])
      visit.height = visit.height || cleanDocumentValue(vitals[2])
      visit.weight = visit.weight || cleanDocumentValue(vitals[3])
      visit.blood_pressure = visit.blood_pressure || cleanDocumentValue(vitals[4])
      visit.respiratory_rate = visit.respiratory_rate || cleanDocumentValue(vitals[5])
      visit.pulse_rate = visit.pulse_rate || cleanDocumentValue(vitals[6])
      visit.oxygen_saturation = visit.oxygen_saturation || cleanDocumentValue(vitals[7])
      visit.clinic_visit_remarks = visit.clinic_visit_remarks || cleanImportedVisitText(vitals[8])
    }

    const pageTwo = compact.match(
      /\bDATE\b\s+SIGNS\s+AND\s+SYMPTOMS[\s\S]{0,220}?(\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+([\s\S]{0,180}?)(?=\s+(?:MEDICATION|FIRST AID|MEDICATION\/FIRST)\b)/i
    )
    if (pageTwo) {
      visit.visit_datetime = visit.visit_datetime || pageTwo[1]
      const complaint = cleanImportedVisitText(pageTwo[2]).replace(/\bSIGNS\s+AND\s+SYMPTOMS\s+REMARKS\b/gi, '').trim()
      if (complaint) visit.signs_symptoms = visit.signs_symptoms || complaint
    }
  }

  const medication = compact.match(/\bMEDICATION\s*\/?\s*FIRST\s*AID\s*PROVIDED\b\s*(?:REMARKS\b\s*)?([\s\S]{0,160}?)(?=\s+DATE\b|\s+Sent Home\b|\s+Attending Physician\b|$)/i)
  if (medication) visit.medication_first_aid = visit.medication_first_aid || cleanImportedVisitText(medication[1])

  const remarks = compact.match(/\bMEDICATION\s*\/?\s*FIRST\s*AID\s*PROVIDED\b[\s\S]{0,220}?\bREMARKS\b\s*([\s\S]{0,160}?)(?=\s+DATE\b|\s+Sent Home\b|\s+Attending Physician\b|$)/i)
  if (remarks) visit.medication_remarks = visit.medication_remarks || cleanImportedVisitText(remarks[1])

  const fallbackSentHome = compact.match(/\bSent Home\b\s*[:\-]?\s*(Yes|No)?(?:\s+Date\s*[:\-]?\s*([0-9/-]+))?(?:\s+Time\s*[:\-]?\s*([0-9: ]+(?:AM|PM)?))?/i)
  if (fallbackSentHome) {
    visit.sent_home = visit.sent_home || fallbackSentHome[1] || 'Yes'
    visit.sent_home_date = visit.sent_home_date || fallbackSentHome[2] || ''
    visit.sent_home_time = visit.sent_home_time || fallbackSentHome[3] || ''
  }

  const fallbackPhysician = compact.match(/\b([A-Za-z][A-Za-z .,'-]{2,80})\s+Attending Physician\b/i)
  if (fallbackPhysician) visit.attending_physician = visit.attending_physician || cleanPhysicianName(fallbackPhysician[1])

  return visit
}

function getDocumentValue(lines, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader)

  for (const line of lines) {
    const normalizedLine = normalizeHeader(line)
    const alias = normalizedAliases.find((item) => normalizedLine.startsWith(item))
    if (!alias) continue

    const pattern = new RegExp(`^\\s*${escapeRegex(alias)}\\s*[:\\-]?\\s*`, 'i')
    const value = cleanDocumentValue(line.replace(pattern, '').trim())
    if (value) return value
  }

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (normalizedAliases.includes(normalizeHeader(lines[index]))) {
      const value = cleanDocumentValue(lines[index + 1])
      if (value && !documentBoundaryLabels.some((label) => normalizeHeader(label) === normalizeHeader(value))) {
        return value
      }
    }
  }

  return ''
}

function splitCourseYear(value) {
  const parts = String(value ?? '')
    .split(/\s*(?:\/|\||,)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    course: parts[0] || value || '',
    yearLevel: parts.find((part) => /year|grade/i.test(part)) || '',
  }
}

function buildImportRowFromText(text) {
  const normalizedText = normalizeDocumentText(text)
  const lines = normalizeDocumentLines(normalizedText)
  const row = Object.fromEntries(
    Object.entries(documentFieldAliases).map(([field, aliases]) => [field, getDocumentValue(lines, aliases)])
  )
  const structured = parseStructuredPersonalFields(text)
  const documentNameParts = parseDocumentNameParts(text)
  const name = composeNameFromParts(documentNameParts) ||
    splitDocumentName(structured.name || row.name || getTextFieldValue(normalizedText, documentFieldAliases.name))
  const courseYear = parseCourseYearGrade(normalizedText)
  const fallbackCourseYear = splitCourseYear(structured.course || row.course)
  const course = normalizeCourseCode(structured.course || courseYear.course || fallbackCourseYear.course)
  const visit = parseVisitTable(text)
  const documentVisits = parseVisitTables(text)
  const vaccinationDates = parseVaccinationDates(text)
  const department = structured.department || getDepartmentForCourse(course) || row.department
  const completeImmunization = parseQuestionAnswerFromRows(text, 1, /complete immunization/i)
  const medicalCondition = parseQuestionAnswerFromRows(text, 2, /medical condition/i)
  const hospitalized = parseQuestionAnswerFromRows(text, 3, /Have you been hospitalized/i)
  const allergy = parseQuestionAnswerFromRows(text, 4, /Do you have allergy/i)
  const covidVaccination = parseQuestionAnswerFromRows(text, 5, /covid vaccination/i)
  const surgery = parseQuestionAnswerFromRows(text, 7, /Any surgery/i)
  const maintenanceMedication = parseQuestionAnswerFromRows(text, 8, /taking any medication|maintenance/i)

  return {
    ...row,
    ...structured,
    ...visit,
    name,
    last_name: documentNameParts.last_name || row.last_name,
    first_name: documentNameParts.first_name || row.first_name,
    middle_name: documentNameParts.middle_name || row.middle_name,
    role: row.role || 'Student',
    department,
    course,
    year_level: structured.year_level || row.year_level || courseYear.yearLevel || fallbackCourseYear.yearLevel,
    section: structured.section || row.section || parseSection(normalizedText),
    gender: structured.gender || row.gender || parseGender(normalizedText),
    course_department: department,
    complete_immunization: completeImmunization,
    missed_immunization: valueOnlyWhenYes(completeImmunization === 'no' ? 'yes' : 'no', getRegexValue(normalizedText, /immunization did you miss\??\s*([\s\S]{0,100}?)(?=\s+Do you have medical|$)/i)),
    medical_condition: medicalCondition,
    medical_condition_details: valueOnlyWhenYes(medicalCondition, getRegexValue(normalizedText, /medical condition[\s\S]{0,120}?If YES,?\s*please specify[:\s]*([\s\S]{0,120}?)(?=\s+Have you been hospitalized|$)/i)),
    hospitalized,
    hospitalization_details: valueOnlyWhenYes(hospitalized, getRegexValue(normalizedText, /Have you been hospitalized[\s\S]{0,100}?If YES,?\s*please specify[:\s]*([\s\S]{0,120}?)(?=\s+Do you have allergy|$)/i)),
    allergy,
    allergy_details: valueOnlyWhenYes(allergy, getRegexValue(normalizedText, /allergy\??\s*If YES,?\s*please specify(?: what)? cause\/?s[:\s]*([\s\S]{0,120}?)(?=\s+Do you have covid|$)/i)),
    covid_vaccination: covidVaccination,
    covid_first_dose: vaccinationDates.covidFirstDose,
    covid_second_dose: vaccinationDates.covidSecondDose,
    covid_booster_1: vaccinationDates.covidBooster1,
    covid_booster_2: vaccinationDates.covidBooster2,
    health_conditions: parseCheckedHealthConditions(text).join(', '),
    surgery,
    surgery_details: valueOnlyWhenYes(surgery, getRegexValue(normalizedText, /Any surgery\??\s*If YES,?\s*please specify[:\s]*([\s\S]{0,120}?)(?=\s+Are you taking|$)/i)),
    maintenance_medication: maintenanceMedication,
    maintenance_medications: valueOnlyWhenYes(maintenanceMedication, getRegexValue(normalizedText, /specify all medications[:\s]*([\s\S]{0,120}?)(?=\s+This information|Signature|CLINIC VISITS|$)/i)),
    document_visits: documentVisits,
  }
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

function normalizeImportTime(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?\s*(AM|PM)?$/i)
  if (!match) return trimmed

  let hour = Number(match[1])
  const minute = Number(match[2] || 0)
  const second = Number(match[3] || 0)
  const meridiem = match[4]?.toUpperCase()

  if (meridiem === 'AM' && hour === 12) hour = 0
  if (meridiem === 'PM' && hour < 12) hour += 12
  if (hour > 23 || minute > 59 || second > 59) return trimmed

  return [
    String(hour).padStart(2, '0'),
    String(minute).padStart(2, '0'),
    String(second).padStart(2, '0'),
  ].join(':')
}

function getSentHomeImportDischargedAt({ dischargedAt, sentHome, sentHomeDate, sentHomeTime, visitDateTime }) {
  if (!sentHome) return dischargedAt
  if (dischargedAt) return dischargedAt

  if (sentHomeDate && sentHomeTime) {
    return toMysqlDateTime(`${sentHomeDate}T${sentHomeTime}`) || visitDateTime || toMysqlDateTime(new Date())
  }

  if (sentHomeDate) {
    return toMysqlDateTime(`${sentHomeDate}T00:00:00`) || visitDateTime || toMysqlDateTime(new Date())
  }

  return visitDateTime || toMysqlDateTime(new Date())
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
    .map(cleanImportedMedicineText)
    .filter(Boolean)
}

function normalizeConditionList(value) {
  return String(value ?? '')
    .split(/\s*(?:,|\r?\n)\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeImportRow(row, rowNumber) {
  const importId = getImportValue(row, 'student_id')
  const importedNameParts = {
    last_name: cleanNamePart(getImportValue(row, 'last_name')),
    first_name: cleanNamePart(getImportValue(row, 'first_name')),
    middle_name: cleanNamePart(getImportValue(row, 'middle_name')),
  }
  const name = composeNameFromParts(importedNameParts) || getImportValue(row, 'name')
  const role = normalizeRole(getImportValue(row, 'role'))
  const isStudent = role === 'Student'
  const courseDepartment = getImportValue(row, 'course_department')
  const courseInput = getImportValue(row, 'course')
  const birthdateInput = getImportValue(row, 'birthdate')
  const { department, course } = splitCourseDepartment(courseDepartment, role)
  const medicationFirstAid = getImportValue(row, 'medication_first_aid')
  const importedMedicines = normalizeMedicineList(getImportValue(row, 'medicine'))
  const medicines = importedMedicines.length > 0 ? importedMedicines : normalizeMedicineList(medicationFirstAid)
  const visitDateTime = getImportDateTime(row, ['time in', 'visit_datetime', 'visit date time', 'date and time of visit'])
  const sentHome = normalizeBoolean(getImportValue(row, 'sent_home')) || 0
  const sentHomeDate = toMysqlDate(getImportValue(row, 'sent_home_date'))
  const sentHomeTime = normalizeImportTime(getImportValue(row, 'sent_home_time'))
  const importedDischargedAt = getImportDateTime(
    row,
    ['time out', 'timeout', 'discharged_at', 'discharge time', 'discharged at'],
    { fallbackToDate: false }
  )
  const dischargedAt = getSentHomeImportDischargedAt({
    dischargedAt: importedDischargedAt,
    sentHome,
    sentHomeDate,
    sentHomeTime,
    visitDateTime,
  })

  return {
    row: rowNumber,
    studentId: isStudent ? importId : '',
    employeeId: isStudent ? '' : importId,
    name,
    lastName: importedNameParts.last_name,
    firstName: importedNameParts.first_name,
    middleName: importedNameParts.middle_name,
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
    completeImmunization: normalizeBoolean(getImportValue(row, 'complete_immunization')),
    missedImmunization: getImportValue(row, 'missed_immunization'),
    medicalCondition: normalizeBoolean(getImportValue(row, 'medical_condition')),
    medicalConditionDetails: getImportValue(row, 'medical_condition_details'),
    hospitalized: normalizeBoolean(getImportValue(row, 'hospitalized')),
    hospitalizationDetails: getImportValue(row, 'hospitalization_details'),
    allergy: normalizeBoolean(getImportValue(row, 'allergy')),
    allergyDetails: getImportValue(row, 'allergy_details'),
    covidVaccination: normalizeBoolean(getImportValue(row, 'covid_vaccination')),
    covidFirstDose: toMysqlDate(getImportValue(row, 'covid_first_dose')),
    covidSecondDose: toMysqlDate(getImportValue(row, 'covid_second_dose')),
    covidBooster1: toMysqlDate(getImportValue(row, 'covid_booster_1')),
    covidBooster2: toMysqlDate(getImportValue(row, 'covid_booster_2')),
    healthConditions: normalizeConditionList(getImportValue(row, 'health_conditions')),
    surgery: normalizeBoolean(getImportValue(row, 'surgery')),
    surgeryDetails: getImportValue(row, 'surgery_details'),
    maintenanceMedication: normalizeBoolean(getImportValue(row, 'maintenance_medication')),
    maintenanceMedications: getImportValue(row, 'maintenance_medications'),
    concern: getImportValue(row, 'concern') || 'General check-up',
    temperature: getImportValue(row, 'temperature'),
    height: getImportValue(row, 'height'),
    weight: getImportValue(row, 'weight'),
    bloodPressure: getImportValue(row, 'blood_pressure'),
    respiratoryRate: getImportValue(row, 'respiratory_rate'),
    pulseRate: getImportValue(row, 'pulse_rate'),
    oxygenSaturation: getImportValue(row, 'oxygen_saturation'),
    signsSymptoms: getImportValue(row, 'signs_symptoms'),
    clinicVisitRemarks: getImportValue(row, 'clinic_visit_remarks'),
    visitRemarks: getImportValue(row, 'visit_remarks'),
    medicationFirstAid,
    medicationRemarks: getImportValue(row, 'medication_remarks'),
    visitDateTime,
    medicines,
    dischargedAt,
    sentHome,
    sentHomeDate,
    sentHomeTime: toNullableString(sentHomeTime),
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

function normalizeNameIdentity(value) {
  return normalizeSignaturePart(value).replace(/[^a-z0-9]/g, '')
}

function patientMatchesImportRow(patient, row) {
  const patientName = normalizeNameIdentity(patient.name)
  const rowName = normalizeNameIdentity(row.name)
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
    record.temperature || '',
    record.height || '',
    record.weight || '',
    record.bloodPressure || '',
    record.respiratoryRate || '',
    record.pulseRate || '',
    record.oxygenSaturation || '',
    record.signsSymptoms || '',
    record.clinicVisitRemarks || '',
    record.visitRemarks || '',
    record.medicationFirstAid || '',
    record.medicationRemarks || '',
    medicines,
  ].map(normalizeSignaturePart).join('::')
}

function isImportableStatus(status) {
  return ['Valid', 'Update'].includes(status)
}

function isProcessableImportStatus(status) {
  return isImportableStatus(status) || status === 'Duplicate'
}

function hasImportedVisitData(row) {
  return [
    row.visitDateTime,
    row.temperature,
    row.height,
    row.weight,
    row.bloodPressure,
    row.respiratoryRate,
    row.pulseRate,
    row.oxygenSaturation,
    row.signsSymptoms,
    row.clinicVisitRemarks,
    row.visitRemarks,
    row.medicationFirstAid,
    row.medicationRemarks,
    row.dischargedAt,
    row.sentHomeDate,
    row.sentHomeTime,
    row.attendingPhysician,
    ...(row.medicines || []),
  ].some((value) => String(value ?? '').trim()) || Boolean(row.sentHome)
}

export function validateImportRecord(record) {
  const errors = []
  const patientId = record.studentId || record.employeeId

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
            v.temperature, v.height, v.weight, v.blood_pressure, v.respiratory_rate,
            v.pulse_rate, v.oxygen_saturation, v.signs_symptoms, v.clinic_visit_remarks,
            v.visit_remarks, v.medication_first_aid, v.medication_remarks,
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

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  )
  return Boolean(rows[0])
}

let patientImportSchemaReady = false
let patientImportSchemaPromise = null

async function runPatientImportSchemaCheck(connection) {
  const patientColumns = [
    ['last_name', 'VARCHAR(191) NULL AFTER name'],
    ['first_name', 'VARCHAR(191) NULL AFTER last_name'],
    ['middle_name', 'VARCHAR(191) NULL AFTER first_name'],
    ['birthdate', 'DATE NULL AFTER section'],
    ['gender', 'VARCHAR(50) NULL AFTER birthdate'],
    ['place_of_birth', 'VARCHAR(191) NULL AFTER gender'],
    ['father_name', 'VARCHAR(191) NULL AFTER place_of_birth'],
    ['father_occupation', 'VARCHAR(191) NULL AFTER father_name'],
    ['mother_name', 'VARCHAR(191) NULL AFTER father_occupation'],
    ['mother_occupation', 'VARCHAR(191) NULL AFTER mother_name'],
    ['email', 'VARCHAR(191) NULL AFTER mother_occupation'],
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
    ['clinic_visit_remarks', 'TEXT NULL AFTER signs_symptoms'],
    ['visit_remarks', 'TEXT NULL AFTER clinic_visit_remarks'],
    ['medication_first_aid', 'TEXT NULL AFTER visit_remarks'],
    ['medication_remarks', 'TEXT NULL AFTER medication_first_aid'],
    ['sent_home', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER discharged_at'],
    ['sent_home_date', 'DATE NULL AFTER sent_home'],
    ['sent_home_time', 'TIME NULL AFTER sent_home_date'],
    ['attending_physician', 'VARCHAR(191) NULL AFTER sent_home_time'],
    ['client_submission_key', 'VARCHAR(191) NULL AFTER attending_physician'],
    ['sent_home_email_sent_at', 'DATETIME NULL AFTER client_submission_key'],
    ['sent_home_email_error', 'TEXT NULL AFTER sent_home_email_sent_at'],
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

  if (!(await indexExists(connection, 'visits', 'visits_client_submission_unique'))) {
    await connection.execute(
      'CREATE UNIQUE INDEX visits_client_submission_unique ON visits (client_submission_key)'
    )
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

export async function ensurePatientImportSchema(connection = pool) {
  if (patientImportSchemaReady) return
  if (patientImportSchemaPromise) return patientImportSchemaPromise

  patientImportSchemaPromise = runPatientImportSchemaCheck(connection)
    .then(() => {
      patientImportSchemaReady = true
    })
    .finally(() => {
      patientImportSchemaPromise = null
    })

  return patientImportSchemaPromise
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

async function extractTextFromPatientDocument(file) {
  const ext = String(file.originalname || '').split('.').pop()?.toLowerCase()

  if (ext === 'docx') {
    const arrayBuffer = await fs.readFile(file.path)
    const { value } = await mammoth.convertToHtml({ buffer: arrayBuffer })
    return stripHtml(value)
  }

  if (['doc', 'html', 'htm'].includes(ext)) {
    const contents = await fs.readFile(file.path, 'utf8')
    return stripHtml(contents)
  }

  if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
    const worker = await createWorker('eng', 1, { langPath: tessdataEngPath })
    try {
      const { data } = await worker.recognize(file.path)
      const pageText = data?.text || ''
      // Full-page OCR frequently misses small handwritten values in the
      // clinic-visit grid. Include the focused, enlarged OCR pass below.
      const handwrittenFields = await extractHandwrittenHealthRecordFields(file.path, pageText, worker)
      return [pageText, handwrittenFields].filter(Boolean).join('\n')
    } finally {
      await worker.terminate()
    }
  }

  const error = new Error('This document type is not supported.')
  error.statusCode = 400
  throw error
}

function cleanHandwrittenField(value, { numeric = false } = {}) {
  const cleaned = String(value || '')
    .replace(/[|_[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return numeric ? cleaned.replace(/[^0-9+/.%-]/g, '') : cleaned
}

async function recognizeHealthRecordCrop(image, dimensions, crop, worker, options = {}) {
  const { width, height } = dimensions
  const left = Math.max(0, Math.round(crop.left * width))
  const top = Math.max(0, Math.round(crop.top * height))
  const cropWidth = Math.min(width - left, Math.max(1, Math.round(crop.width * width)))
  const cropHeight = Math.min(height - top, Math.max(1, Math.round(crop.height * height)))
  const buffer = await sharp(image)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: Math.max(900, cropWidth * 3), withoutEnlargement: false })
    .grayscale()
    .normalise()
    .sharpen()
    .png()
    .toBuffer()

  await worker.setParameters({ tessedit_pageseg_mode: '7' })
  const { data } = await worker.recognize(buffer)
  return cleanHandwrittenField(data?.text, options)
}

async function extractHandwrittenHealthRecordFields(imagePath, pageText, worker) {
  let dimensions
  try {
    dimensions = await sharp(imagePath).metadata()
  } catch {
    return ''
  }

  if (!dimensions.width || !dimensions.height) return ''

  const isPersonalPage = /PERSONAL\s+DATA|DATE\s+OF\s+BIRTH/i.test(pageText)
  const isClinicVisitPage = /CLINIC\s+VISITS/i.test(pageText)
  const fields = isClinicVisitPage && !isPersonalPage
    ? [
        // The compact clinic-visit form places its first handwritten row just
        // below the table headings. These narrow crops preserve each column.
        ['visitDate', { left: 0.08, top: 0.24, width: 0.13, height: 0.06 }, { numeric: true }],
        ['temperature', { left: 0.22, top: 0.24, width: 0.08, height: 0.06 }],
        ['height', { left: 0.31, top: 0.24, width: 0.08, height: 0.06 }],
        ['weight', { left: 0.40, top: 0.24, width: 0.08, height: 0.06 }],
        ['bloodPressure', { left: 0.49, top: 0.24, width: 0.09, height: 0.06 }, { numeric: true }],
        ['respiratoryRate', { left: 0.59, top: 0.24, width: 0.05, height: 0.06 }, { numeric: true }],
        ['pulseRate', { left: 0.65, top: 0.24, width: 0.05, height: 0.06 }, { numeric: true }],
        ['oxygenSaturation', { left: 0.71, top: 0.24, width: 0.13, height: 0.06 }, { numeric: true }],
        ['clinicVisitRemarks', { left: 0.85, top: 0.24, width: 0.10, height: 0.06 }],
      ]
    : isPersonalPage
    ? [
        ['lastName', { left: 0.18, top: 0.116, width: 0.22, height: 0.034 }],
        ['firstName', { left: 0.42, top: 0.116, width: 0.28, height: 0.034 }],
        ['middleName', { left: 0.72, top: 0.116, width: 0.22, height: 0.034 }],
        ['courseYear', { left: 0.20, top: 0.151, width: 0.25, height: 0.034 }],
        ['section', { left: 0.54, top: 0.151, width: 0.16, height: 0.034 }],
        ['birthdate', { left: 0.20, top: 0.183, width: 0.22, height: 0.034 }, { numeric: true }],
        ['placeOfBirth', { left: 0.56, top: 0.183, width: 0.36, height: 0.034 }],
        ['fatherName', { left: 0.20, top: 0.205, width: 0.38, height: 0.032 }],
        ['fatherOccupation', { left: 0.72, top: 0.205, width: 0.20, height: 0.032 }],
        ['motherName', { left: 0.20, top: 0.228, width: 0.38, height: 0.032 }],
        ['motherOccupation', { left: 0.72, top: 0.228, width: 0.20, height: 0.032 }],
        ['address', { left: 0.20, top: 0.251, width: 0.70, height: 0.032 }],
        ['emergencyName1', { left: 0.28, top: 0.276, width: 0.34, height: 0.032 }],
        ['emergencyPhone1', { left: 0.72, top: 0.276, width: 0.20, height: 0.032 }, { numeric: true }],
        ['emergencyName2', { left: 0.28, top: 0.299, width: 0.34, height: 0.032 }],
        ['emergencyPhone2', { left: 0.72, top: 0.299, width: 0.20, height: 0.032 }, { numeric: true }],
        ['bloodType', { left: 0.20, top: 0.322, width: 0.10, height: 0.032 }],
        ['contact', { left: 0.42, top: 0.322, width: 0.21, height: 0.032 }, { numeric: true }],
      ]
    : [
        ['name', { left: 0.14, top: 0.037, width: 0.40, height: 0.034 }],
        ['visitDate', { left: 0.07, top: 0.079, width: 0.10, height: 0.11 }, { numeric: true }],
        ['signsSymptoms', { left: 0.17, top: 0.079, width: 0.42, height: 0.11 }],
        ['visitRemarks', { left: 0.61, top: 0.079, width: 0.31, height: 0.11 }],
        ['medication', { left: 0.07, top: 0.214, width: 0.50, height: 0.10 }],
        ['medicationRemarks', { left: 0.61, top: 0.214, width: 0.31, height: 0.10 }],
        ['sentHome', { left: 0.13, top: 0.945, width: 0.12, height: 0.035 }],
        ['sentHomeDate', { left: 0.30, top: 0.945, width: 0.12, height: 0.035 }, { numeric: true }],
        ['sentHomeTime', { left: 0.43, top: 0.945, width: 0.13, height: 0.035 }],
        ['attendingPhysician', { left: 0.58, top: 0.945, width: 0.32, height: 0.035 }],
      ]

  const values = {}
  for (const [name, crop, options] of fields) {
    values[name] = await recognizeHealthRecordCrop(imagePath, dimensions, crop, worker, options)
  }

  if (isClinicVisitPage && !isPersonalPage) {
    return [
      values.visitDate && `DATE: ${values.visitDate}`,
      values.temperature && `TEMPERATURE: ${values.temperature}`,
      values.height && `HEIGHT: ${values.height}`,
      values.weight && `WEIGHT: ${values.weight}`,
      values.bloodPressure && `BLOOD PRESSURE: ${values.bloodPressure}`,
      values.respiratoryRate && `RESPIRATORY RATE: ${values.respiratoryRate}`,
      values.pulseRate && `PULSE RATE: ${values.pulseRate}`,
      values.oxygenSaturation && `OXYGEN SATURATION: ${values.oxygenSaturation}`,
      values.clinicVisitRemarks && `CLINIC VISIT REMARKS: ${values.clinicVisitRemarks}`,
    ].filter(Boolean).join('\n')
  }

  if (isPersonalPage) {
    const name = [values.lastName, values.firstName, values.middleName].filter(Boolean).join(', ').replace(/, ([^,]+), (.+)$/, ', $1 $2')
    return [
      name && `NAME: ${name}`,
      values.lastName && `LAST NAME: ${values.lastName}`,
      values.firstName && `FIRST NAME: ${values.firstName}`,
      values.middleName && `MIDDLE NAME: ${values.middleName}`,
      values.courseYear && `COURSE/YR/GRADE: ${values.courseYear}`,
      values.section && `SECTION: ${values.section}`,
      values.birthdate && `DATE OF BIRTH: ${values.birthdate}`,
      values.placeOfBirth && `PLACE OF BIRTH: ${values.placeOfBirth}`,
      values.fatherName && `FATHER'S NAME: ${values.fatherName}`,
      values.fatherOccupation && `FATHER'S OCCUPATION: ${values.fatherOccupation}`,
      values.motherName && `MOTHER'S NAME: ${values.motherName}`,
      values.motherOccupation && `MOTHER'S OCCUPATION: ${values.motherOccupation}`,
      values.address && `HOME ADDRESS: ${values.address}`,
      values.emergencyName1 && `EMERGENCY CONTACT PERSON: ${values.emergencyName1}`,
      values.emergencyPhone1 && `TEL/CP NO: ${values.emergencyPhone1}`,
      values.emergencyName2 && `EMERGENCY CONTACT PERSON: ${values.emergencyName2}`,
      values.emergencyPhone2 && `TEL/CP NO: ${values.emergencyPhone2}`,
      values.bloodType && `BLOOD TYPE: ${values.bloodType}`,
      values.contact && `MOBILE NO: ${values.contact}`,
    ].filter(Boolean).join('\n')
  }

  return [
    values.name && `NAME: ${values.name}`,
    values.visitDate && `DATE: ${values.visitDate}`,
    values.signsSymptoms && `SIGNS AND SYMPTOMS: ${values.signsSymptoms}`,
    values.visitRemarks && `VISIT REMARKS: ${values.visitRemarks}`,
    values.medication && `MEDICATION/FIRST AID PROVIDED: ${values.medication}`,
    values.medicationRemarks && `MEDICATION REMARKS: ${values.medicationRemarks}`,
    values.sentHome && `SENT HOME: ${values.sentHome}`,
    values.sentHomeDate && `SENT HOME DATE: ${values.sentHomeDate}`,
    values.sentHomeTime && `SENT HOME TIME: ${values.sentHomeTime}`,
    values.attendingPhysician && `ATTENDING PHYSICIAN: ${values.attendingPhysician}`,
  ].filter(Boolean).join('\n')
}

export async function previewPatientDocumentImport(fileOrFiles) {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
  try {
    const extractedTexts = await Promise.all(files.map((file) => extractTextFromPatientDocument(file)))
    // A health record often has personal data on one page and clinic visits on another.
    // Combining the OCR output lets the parser use both pages for one record.
    const text = extractedTexts.filter(Boolean).join('\n\n')
    const documentRow = buildImportRowFromText(text)
    const visits = Array.isArray(documentRow.document_visits) && documentRow.document_visits.length
      ? documentRow.document_visits
      : [{}]
    // `buildImportRowFromText` also contains the first visit as a convenient
    // single-visit fallback.  Do not spread those values into every visit:
    // doing that turns an empty/missed field in a later notes table into a
    // copy of the previous visit's complaint, medication, or remarks.
    const patientDocumentRow = { ...documentRow }
    ;[
      'document_visits', 'concern', 'visit_datetime', 'temperature', 'height',
      'weight', 'blood_pressure', 'respiratory_rate', 'pulse_rate',
      'oxygen_saturation', 'signs_symptoms', 'clinic_visit_remarks',
      'visit_remarks', 'medication_first_aid', 'medication_remarks',
    ].forEach((field) => delete patientDocumentRow[field])
    const records = visits.map((visit, index) => normalizeImportRow({
      ...patientDocumentRow,
      ...visit,
      // The footer is shared by the exported document rather than repeated in
      // each detail table, so it remains a document-level fallback.
      sent_home: visit.sent_home || patientDocumentRow.sent_home,
      sent_home_date: visit.sent_home_date || patientDocumentRow.sent_home_date,
      sent_home_time: visit.sent_home_time || patientDocumentRow.sent_home_time,
      attending_physician: visit.attending_physician || patientDocumentRow.attending_physician,
    }, index + 1))
    await ensurePatientImportSchema()
    const existingIds = await getExistingPatientIds()
    const existingVisitSignatures = await getExistingVisitSignatures()
    const rows = buildImportPreview(records, existingIds, existingVisitSignatures)
    const errors = rows.flatMap((row) => row.errors || [])

    return {
      requiredFields: PATIENT_IMPORT_REQUIRED_FIELDS,
      rows,
      errors,
      summary: summarizePreviewRows(rows),
      extractedText: text,
    }
  } finally {
    await Promise.all(files.filter(Boolean).map((file) => fs.rm(file.path, { force: true })))
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

async function replaceImportedVisitMedicines(connection, visitId, medicineNames = []) {
  await connection.execute('DELETE FROM visit_medicines WHERE visit_id = ?', [visitId])

  for (const medicineName of medicineNames) {
    const [medicineRows] = await connection.execute(
      'SELECT id FROM medicines WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [medicineName]
    )

    await connection.execute(
      'INSERT INTO visit_medicines (visit_id, medicine_id, medicine_name) VALUES (?, ?, ?)',
      [visitId, medicineRows[0]?.id || null, medicineName]
    )
  }
}

async function createImportedVisit(connection, row, patientRecordId) {
  if (!patientRecordId) return false

  const visitDateTime = row.visitDateTime || toMysqlDateTime(new Date())
  const timestamp = new Date(visitDateTime).getTime() || Date.now()
  const [existingRows] = await connection.execute(
    `SELECT id
     FROM visits
     WHERE patient_record_id = ?
       AND DATE(visit_datetime) = DATE(?)
       AND COALESCE(temperature, '') = COALESCE(?, '')
       AND COALESCE(height, '') = COALESCE(?, '')
       AND COALESCE(weight, '') = COALESCE(?, '')
       AND COALESCE(blood_pressure, '') = COALESCE(?, '')
       AND COALESCE(respiratory_rate, '') = COALESCE(?, '')
       AND COALESCE(pulse_rate, '') = COALESCE(?, '')
       AND COALESCE(oxygen_saturation, '') = COALESCE(?, '')
     ORDER BY id DESC
     LIMIT 1`,
    [
      patientRecordId,
      visitDateTime,
      toNullableString(row.temperature),
      toNullableString(row.height),
      toNullableString(row.weight),
      toNullableString(row.bloodPressure),
      toNullableString(row.respiratoryRate),
      toNullableString(row.pulseRate),
      toNullableString(row.oxygenSaturation),
    ]
  )

  if (existingRows[0]) {
    await connection.execute(
      `UPDATE visits
       SET concern = COALESCE(?, concern),
           temperature = COALESCE(?, temperature),
           height = COALESCE(?, height),
           weight = COALESCE(?, weight),
           blood_pressure = COALESCE(?, blood_pressure),
           respiratory_rate = COALESCE(?, respiratory_rate),
           pulse_rate = COALESCE(?, pulse_rate),
           oxygen_saturation = COALESCE(?, oxygen_saturation),
           signs_symptoms = COALESCE(?, signs_symptoms),
           clinic_visit_remarks = COALESCE(?, clinic_visit_remarks),
           visit_remarks = COALESCE(?, visit_remarks),
           medication_first_aid = COALESCE(?, medication_first_aid),
           medication_remarks = COALESCE(?, medication_remarks),
           discharged_at = COALESCE(?, discharged_at),
           sent_home = COALESCE(?, sent_home),
           sent_home_date = COALESCE(?, sent_home_date),
           sent_home_time = COALESCE(?, sent_home_time),
           attending_physician = COALESCE(?, attending_physician)
       WHERE id = ?`,
      [
        toNullableString(row.concern),
        toNullableString(row.temperature),
        toNullableString(row.height),
        toNullableString(row.weight),
        toNullableString(row.bloodPressure),
        toNullableString(row.respiratoryRate),
        toNullableString(row.pulseRate),
        toNullableString(row.oxygenSaturation),
        toNullableString(row.signsSymptoms),
        toNullableString(row.clinicVisitRemarks),
        toNullableString(row.visitRemarks),
        toNullableString(row.medicationFirstAid),
        toNullableString(row.medicationRemarks),
        row.dischargedAt || null,
        row.sentHome ? 1 : null,
        row.sentHomeDate || null,
        row.sentHomeTime || null,
        toNullableString(row.attendingPhysician),
        existingRows[0].id,
      ]
    )

    await replaceImportedVisitMedicines(connection, existingRows[0].id, row.medicines)

    return 'updated'
  }

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
      toNullableString(row.clinicVisitRemarks),
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

  await replaceImportedVisitMedicines(connection, result.insertId, row.medicines)

  return 'created'
}

async function upsertImportedPatient(connection, row) {
  const recordId = row.studentId || row.employeeId
  const idColumn = row.studentId ? 'student_id' : 'employee_id'
  const values = [
    row.name,
    toNullableString(row.lastName),
    toNullableString(row.firstName),
    toNullableString(row.middleName),
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
    row.completeImmunization,
    toNullableString(row.missedImmunization),
    row.medicalCondition,
    toNullableString(row.medicalConditionDetails),
    row.hospitalized,
    toNullableString(row.hospitalizationDetails),
    row.allergy,
    toNullableString(row.allergyDetails),
    row.covidVaccination,
    row.covidFirstDose || null,
    row.covidSecondDose || null,
    row.covidBooster1 || null,
    row.covidBooster2 || null,
    JSON.stringify(Array.isArray(row.healthConditions) ? row.healthConditions.filter(Boolean) : []),
    row.surgery,
    toNullableString(row.surgeryDetails),
    row.maintenanceMedication,
    toNullableString(row.maintenanceMedications),
  ]

  const [patientRows] = recordId
    ? await connection.execute(
        `SELECT * FROM patient_records WHERE ${idColumn} = ? LIMIT 1`,
        [recordId]
      )
    : await connection.execute(
        `SELECT * FROM patient_records
         WHERE LOWER(position) = LOWER(?)
         ORDER BY registered_at DESC, id DESC
         LIMIT 200`,
        [row.role || 'Student']
      )

  const matchedPatient = recordId
    ? patientRows[0]
    : patientRows.find((patient) =>
        normalizeNameIdentity(patient.name) === normalizeNameIdentity(row.name)
      )

  if (matchedPatient) {
    if (!patientMatchesImportRow(matchedPatient, row)) {
      throw createPatientConflictError(matchedPatient, recordId)
    }

    await connection.execute(
      `UPDATE patient_records
       SET name = ?, last_name = ?, first_name = ?, middle_name = ?,
           position = ?, department = ?, course = ?, year_level = ?, section = ?,
           birthdate = ?, gender = ?, place_of_birth = ?, father_name = ?, father_occupation = ?,
           mother_name = ?, mother_occupation = ?, contact = ?, address = ?,
           emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_name_2 = ?,
           emergency_contact_phone_2 = ?, blood_type = ?, complete_immunization = ?, missed_immunization = ?,
           medical_condition = ?, medical_condition_details = ?, hospitalized = ?, hospitalization_details = ?,
           allergy = ?, allergy_details = ?, covid_vaccination = ?, covid_first_dose = ?, covid_second_dose = ?,
           covid_booster_1 = ?, covid_booster_2 = ?, health_conditions_json = ?, surgery = ?, surgery_details = ?,
           maintenance_medication = ?, maintenance_medications = ?
       WHERE id = ?`,
      [...values, matchedPatient.id]
    )
    return { id: matchedPatient.id, action: 'updated' }
  }

  const [result] = await connection.execute(
    `INSERT INTO patient_records
     (student_id, employee_id, name, last_name, first_name, middle_name, position, department, course, year_level,
      section, birthdate, gender, place_of_birth, father_name, father_occupation,
      mother_name, mother_occupation, contact, address, emergency_contact_name,
      emergency_contact_phone, emergency_contact_name_2, emergency_contact_phone_2,
      blood_type, complete_immunization, missed_immunization, medical_condition,
      medical_condition_details, hospitalized, hospitalization_details, allergy,
      allergy_details, covid_vaccination, covid_first_dose, covid_second_dose,
      covid_booster_1, covid_booster_2, health_conditions_json, surgery,
      surgery_details, maintenance_medication, maintenance_medications, registered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.studentId || null,
      row.employeeId || null,
      row.name,
      toNullableString(row.lastName),
      toNullableString(row.firstName),
      toNullableString(row.middleName),
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
      row.completeImmunization,
      toNullableString(row.missedImmunization),
      row.medicalCondition,
      toNullableString(row.medicalConditionDetails),
      row.hospitalized,
      toNullableString(row.hospitalizationDetails),
      row.allergy,
      toNullableString(row.allergyDetails),
      row.covidVaccination,
      row.covidFirstDose || null,
      row.covidSecondDose || null,
      row.covidBooster1 || null,
      row.covidBooster2 || null,
      JSON.stringify(Array.isArray(row.healthConditions) ? row.healthConditions.filter(Boolean) : []),
      row.surgery,
      toNullableString(row.surgeryDetails),
      row.maintenanceMedication,
      toNullableString(row.maintenanceMedications),
      toMysqlDateTime(new Date()),
    ]
  )

  return { id: result.insertId, action: 'imported' }
}

export async function confirmPatientImport(rows, { userId, fileName } = {}) {
  await ensurePatientImportSchema()

  return transaction(async (connection) => {
    const existingIds = await getExistingPatientIds(connection)
    const existingVisitSignatures = await getExistingVisitSignatures(connection)
    const previewRows = buildImportPreview(rows, existingIds, existingVisitSignatures)
    const importableRows = previewRows.filter((row) => isProcessableImportStatus(row.status))
    const imported = []
    const updated = []
    let visitsCreated = 0

    for (const row of importableRows) {
      const patient = await upsertImportedPatient(connection, row)
      // A personal-data-only file should not create an empty visit dated "now".
      const visitAction = hasImportedVisitData(row)
        ? await createImportedVisit(connection, row, patient.id)
        : false
      if (visitAction === 'created') visitsCreated += 1

      if (patient.action === 'updated') {
        updated.push(row.studentId || row.employeeId || row.name)
      } else {
        existingIds.add(getRecordImportKey(row))
        imported.push(row.studentId || row.employeeId || row.name)
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
