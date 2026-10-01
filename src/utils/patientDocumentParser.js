import mammoth from 'mammoth'

const fieldAliases = {
  name: ['name', 'full name', 'patient name', 'student name'],
  studentId: ['student id', 'student no', 'student number', 'id number'],
  employeeId: ['employee id', 'employee no'],
  position: ['position', 'role'],
  department: ['department'],
  course: ['course', 'course/yr/ grade', 'course/grade', 'course / grade', 'program'],
  yearLevel: ['year level', 'year', 'level'],
  section: ['section', 'block'],
  birthdate: ['date of birth', 'birthdate', 'birth date', 'dob'],
  gender: ['gender', 'sex'],
  placeOfBirth: ['place of birth', 'birth place'],
  fatherName: ["father's name", 'father name'],
  fatherOccupation: ["father's occupation", 'father occupation'],
  motherName: ["mother's name", 'mother name'],
  motherOccupation: ["mother's occupation", 'mother occupation'],
  address: ['home address', 'address'],
  contact: ['mobile no', 'mobile number', 'contact number', 'contact', 'tel/cp no'],
  emergencyContactName: ['emergency contact person', 'emergency contact'],
  emergencyContactPhone: ['emergency contact number', 'emergency phone', 'tel/cp no'],
  emergencyContactName2: ['emergency contact person 2', 'emergency contact 2'],
  emergencyContactPhone2: ['emergency contact number 2', 'emergency phone 2', 'tel/cp no 2'],
  bloodType: ['blood type'],
}

function normalizeLabel(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDate(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return ''

  const iso = trimmed.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const slash = trimmed.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/)
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3]
    return `${year}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toISOString().slice(0, 10)
}

function getFieldValue(lines, aliases) {
  const normalizedAliases = aliases.map(normalizeLabel)

  for (const line of lines) {
    const normalizedLine = normalizeLabel(line)
    const alias = normalizedAliases.find((item) => normalizedLine.startsWith(item))
    if (!alias) continue

    const pattern = new RegExp(`^\\s*${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-]?\\s*`, 'i')
    const value = line.replace(pattern, '').trim()
    if (value) return value
  }

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (normalizedAliases.includes(normalizeLabel(lines[index]))) {
      return lines[index + 1].trim()
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

export async function parsePatientDocument(file) {
  const arrayBuffer = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer })
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, ' ').trim())
    .filter(Boolean)

  const record = Object.fromEntries(
    Object.entries(fieldAliases).map(([field, aliases]) => [field, getFieldValue(lines, aliases)])
  )
  const courseYear = splitCourseYear(record.course)

  return {
    ...record,
    position: record.position || 'Student',
    course: courseYear.course,
    yearLevel: record.yearLevel || courseYear.yearLevel,
    birthdate: normalizeDate(record.birthdate),
    healthConditions: [],
  }
}
