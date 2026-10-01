import { useCallback, useEffect, useMemo, useState } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { getCachedArray, hasCachedArray, setCachedArray } from '../src/utils/clinicDataCache'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import LoadingOverlay from '../src/components/LoadingOverlay'
import { formatVisitDate, getInitials, toLocalDateTimeInputValue } from '../src/utils/visitHelpers'
import { defaultMedicineInventory } from '../src/data/constants'

const conditionOptions = [
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

const personalDefaults = {
  name: '',
  lastName: '',
  firstName: '',
  middleName: '',
  studentId: '',
  employeeId: '',
  position: 'Student',
  department: '',
  course: '',
  yearLevel: '',
  section: '',
  birthdate: '',
  gender: '',
  placeOfBirth: '',
  fatherName: '',
  fatherOccupation: '',
  motherName: '',
  motherOccupation: '',
  email: '',
  address: '',
  contact: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactName2: '',
  emergencyContactPhone2: '',
  bloodType: '',
  completeImmunization: '',
  missedImmunization: '',
  medicalCondition: '',
  medicalConditionDetails: '',
  hospitalized: '',
  hospitalizationDetails: '',
  allergy: '',
  allergyDetails: '',
  covidVaccination: '',
  covidFirstDose: '',
  covidSecondDose: '',
  covidBooster1: '',
  covidBooster2: '',
  healthConditions: [],
  surgery: '',
  surgeryDetails: '',
  maintenanceMedication: '',
  maintenanceMedications: '',
  signatureName: '',
}

const visitDefaults = {
  id: '',
  visitDateTime: '',
  concern: '',
  temperature: '',
  height: '',
  weight: '',
  bloodPressure: '',
  respiratoryRate: '',
  pulseRate: '',
  oxygenSaturation: '',
  signsSymptoms: '',
  clinicVisitRemarks: '',
  visitRemarks: '',
  medicationFirstAid: '',
  medicationRemarks: '',
  dischargedAt: '',
  sentHome: false,
  sentHomeDate: '',
  sentHomeTime: '',
  email: '',
  attendingPhysician: '',
  medicines: [],
}

const MEDICINE_CATEGORIES = [
  'Pain & Fever',
  'Respiratory',
  'Gastrointestinal',
  'Cardiovascular',
  'Allergy',
  'General',
]

const OLD_MEDICINE_CATEGORY_MAP = {
  'Fever and pain relief': 'Pain & Fever',
  'Pain and fever': 'Pain & Fever',
  'Pain, fever, and inflammation': 'Pain & Fever',
  'Pain relief': 'Pain & Fever',
  'Colds and fever': 'Respiratory',
  'Flu and colds': 'Respiratory',
  'Stomach and acidity': 'Gastrointestinal',
  Allergy: 'Allergy',
  'Wound care': 'General',
  Disinfectant: 'General',
  'General medicine': 'General',
}

function parseMedicineSelection(item) {
  if (typeof item !== 'string') {
    return {
      name: String(item?.name || '').trim(),
      quantity: Number(item?.quantity),
    }
  }

  const value = item.trim()
  const compactMatch = value.match(/^(.*?)::(\d+)$/)
  const trailingMatch = value.match(/^(.*?)\s+x\s*(\d+)$/i)
  const leadingMatch = value.match(/^(\d+)\s+(.+)$/)

  if (compactMatch) return { name: compactMatch[1].trim(), quantity: Number(compactMatch[2]) }
  if (trailingMatch) return { name: trailingMatch[1].trim(), quantity: Number(trailingMatch[2]) }
  if (leadingMatch) return { name: leadingMatch[2].trim(), quantity: Number(leadingMatch[1]) }
  return { name: value, quantity: 1 }
}

function getMedicineName(item) {
  return parseMedicineSelection(item).name
}

function getMedicineQuantity(item) {
  const quantity = parseMedicineSelection(item).quantity
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
}

function displayClinicVisitRemarks(value) {
  const remarks = String(value || '').trim()
  // Repair the visual result of older imports where Word placed the next
  // clinic row after "Normal" in this one field.
  return /^normal\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/i.test(remarks) ? 'Normal' : remarks
}

function normalizeMedicineSelections(medicines) {
  const selections = new Map()

  medicines.forEach((item) => {
    const name = getMedicineName(item)
    if (!name) return
    const key = name.toLowerCase()
    const current = selections.get(key)
    selections.set(key, {
      name: current?.name || name,
      quantity: (current?.quantity || 0) + getMedicineQuantity(item),
    })
  })

  return Array.from(selections.values())
}

function formatMedicineSelection(medicines) {
  return medicines
    .map((item) => {
      const name = getMedicineName(item)
      if (!name) return ''
      const quantity = getMedicineQuantity(item)
      return quantity > 1 ? `${quantity} ${name}` : name
    })
    .filter(Boolean)
    .join(', ')
}

function normalizeMedicineCategory(category) {
  const value = String(category || '').trim()
  if (!value) return 'General'
  if (MEDICINE_CATEGORIES.includes(value)) return value
  return OLD_MEDICINE_CATEGORY_MAP[value] || 'General'
}

function getDefaultMedicineCategory(name) {
  const category = defaultMedicineInventory.find(
    (medicine) => medicine.name.toLowerCase() === String(name).toLowerCase()
  )?.category || 'General'
  return normalizeMedicineCategory(category)
}

function normalizeMedicineItem(item) {
  return {
    ...item,
    category: normalizeMedicineCategory(item.category || getDefaultMedicineCategory(item.name)),
  }
}

const personalRequiredFields = [
  { field: 'lastName', label: 'Last Name' },
  { field: 'firstName', label: 'First Name' },
  { field: 'position', label: 'Position' },
  { field: 'department', label: 'Department' },
  { field: 'course', label: 'Course / Grade', when: (data) => !data.position || data.position === 'Student' },
  { field: 'birthdate', label: 'Date of Birth' },
  { field: 'gender', label: 'Gender' },
  { field: 'bloodType', label: 'Blood Type' },
  { field: 'address', label: 'Home Address' },
  { field: 'contact', label: 'Mobile No.' },
  { field: 'emergencyContactName', label: 'Emergency Contact Person' },
  { field: 'emergencyContactPhone', label: 'Emergency Contact Number' },
  { field: 'missedImmunization', label: 'Missed immunization reason', when: (data) => data.completeImmunization === 'no' },
  { field: 'medicalConditionDetails', label: 'Medical condition details', when: (data) => data.medicalCondition === 'yes' },
  { field: 'hospitalizationDetails', label: 'Hospitalization details', when: (data) => data.hospitalized === 'yes' },
  { field: 'allergyDetails', label: 'Allergy cause/s', when: (data) => data.allergy === 'yes' },
  { field: 'surgeryDetails', label: 'Surgery details', when: (data) => data.surgery === 'yes' },
  { field: 'maintenanceMedications', label: 'Medication / maintenance details', when: (data) => data.maintenanceMedication === 'yes' },
]

const cpNumberFields = new Set(['contact', 'emergencyContactPhone', 'emergencyContactPhone2'])

const conditionalErrorFields = {
  completeImmunization: ['missedImmunization'],
  medicalCondition: ['medicalConditionDetails'],
  hospitalized: ['hospitalizationDetails'],
  allergy: ['allergyDetails'],
  covidVaccination: ['covidFirstDose', 'covidSecondDose', 'covidBooster1', 'covidBooster2'],
  surgery: ['surgeryDetails'],
  maintenanceMedication: ['maintenanceMedications'],
}

const documentCheckMark = String.fromCharCode(0x2713)

const academicDirectory = [
  {
    department: 'College of Information and Computer Studies',
    courses: ['ACT', 'BSCS'],
  },
  {
    department: 'College of Education',
    courses: ['BEEd', 'BSEd'],
  },
  {
    department: 'College of Business and Accountancy',
    courses: ['BSA', 'BSBA'],
  },
  {
    department: 'College of Criminal Justice Education',
    courses: ['BSCRIM'],
  },
  {
    department: 'College of Public Administration',
    courses: ['BPA'],
  },
  {
    department: 'College of Hospitality and Tourism Management',
    courses: ['BSTM'],
  },
]

const uncategorizedDepartment = 'Uncategorized Department'
const uncategorizedCourse = 'Uncategorized Course'
const unspecifiedYearLevel = 'Year Not Specified'
const otherCategory = 'Other / Uncategorized'
const standardYearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year']

const directoryDepartmentNames = academicDirectory.map((item) => item.department)
const departmentLookup = new Map(
  academicDirectory.map((item) => [normalizeDirectoryValue(item.department), item.department])
)

function normalizeDirectoryValue(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function formatRecordCount(count, label = 'profile') {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function formatSectionLabel(section) {
  const value = String(section ?? '').trim()
  if (!value) return ''
  return /^section\b/i.test(value) ? value : `Section ${value}`
}

function createDirectoryKey(...parts) {
  return parts.map((part) => normalizeDirectoryValue(part) || 'blank').join('::')
}

function getDepartmentBucketName(record) {
  const department = String(record.department ?? '').trim()
  if (!department) return uncategorizedDepartment
  return departmentLookup.get(normalizeDirectoryValue(department)) || otherCategory
}

function getRecordRole(record) {
  return normalizeDirectoryValue(record.position || 'Student') || 'student'
}

function getCourseYearLevels(course) {
  return normalizeDirectoryValue(course) === 'act' ? standardYearLevels.slice(0, 2) : standardYearLevels
}

function createStudentCourseGroup(name, includeDefaultYears = true) {
  const years = includeDefaultYears ? getCourseYearLevels(name) : []
  return {
    name,
    count: 0,
    yearMap: new Map(years.map((year) => [year, { name: year, records: [] }])),
  }
}

function buildCollegeGroups(records, role) {
  const groups = new Map(directoryDepartmentNames.map((name) => [name, { name, records: [] }]))
  records
    .filter((record) => getRecordRole(record) === role)
    .forEach((record) => {
      const department = getDepartmentBucketName(record)
      if (!groups.has(department)) groups.set(department, { name: department, records: [] })
      groups.get(department).records.push(record)
    })
  return Array.from(groups.values())
}

function buildStudentCollegeGroups(records) {
  const groups = new Map(academicDirectory.map(({ department, courses }) => [
    department,
    { name: department, count: 0, courseMap: new Map(courses.map((course) => [course, createStudentCourseGroup(course)])) },
  ]))

  records
    .filter((record) => getRecordRole(record) === 'student')
    .forEach((record) => {
      const department = getDepartmentBucketName(record)
      if (!groups.has(department)) groups.set(department, { name: department, count: 0, courseMap: new Map() })
      const group = groups.get(department)
      const rawCourse = String(record.course || '').trim() || uncategorizedCourse
      const knownCourse = group.courseMap.has(rawCourse)
        ? rawCourse
        : Array.from(group.courseMap.keys()).find((course) => normalizeDirectoryValue(course) === normalizeDirectoryValue(rawCourse))
      const course = knownCourse || rawCourse
      if (!group.courseMap.has(course)) group.courseMap.set(course, createStudentCourseGroup(course, false))
      const courseGroup = group.courseMap.get(course)
      const rawYear = String(record.yearLevel || '').trim() || unspecifiedYearLevel
      const year = Array.from(courseGroup.yearMap.keys()).find(
        (level) => normalizeDirectoryValue(level) === normalizeDirectoryValue(rawYear)
      ) || rawYear
      if (!courseGroup.yearMap.has(year)) courseGroup.yearMap.set(year, { name: year, records: [] })
      group.count += 1
      courseGroup.count += 1
      courseGroup.yearMap.get(year).records.push(record)
    })

  return Array.from(groups.values()).map((group) => ({
    ...group,
    courses: Array.from(group.courseMap.values()).map((course) => ({
      ...course,
      years: Array.from(course.yearMap.values()),
    })),
  }))
}

function buildRecordDirectory(records) {
  const byRole = (role) => records.filter((record) => getRecordRole(record) === role)
  const students = byRole('student')
  const instructors = byRole('instructor')
  const admins = byRole('admin')
  const staff = byRole('staff')
  const guards = byRole('guard')
  const maintenance = byRole('maintenance')
  const knownRoles = new Set(['student', 'instructor', 'admin', 'staff', 'guard', 'maintenance'])
  const otherEmployees = records.filter((record) => !knownRoles.has(getRecordRole(record)))

  return {
    students: { count: students.length, colleges: buildStudentCollegeGroups(records) },
    employees: {
      count: records.length - students.length,
      academic: { count: instructors.length, colleges: buildCollegeGroups(records, 'instructor') },
      operations: {
        count: admins.length + staff.length + guards.length + maintenance.length + otherEmployees.length,
        admin: { count: admins.length, colleges: buildCollegeGroups(records, 'admin') },
        staff,
        guards,
        maintenance,
        otherEmployees,
      },
    },
  }
}

function RequiredMark() {
  return <span className="text-red-500">*</span>
}

function FieldError({ message }) {
  return message ? <span className="required-helper">{message}</span> : null
}

function DirectoryRecordList({ records, selectedId, onSelect }) {
  if (!records.length) return <p className="directory-empty">No profiles in this group yet.</p>

  return (
    <div className="student-list directory-student-list">
      {records.map((record) => (
        <button
          key={record.id}
          type="button"
          className={String(record.id) === String(selectedId) ? 'student-row active' : 'student-row'}
          onClick={() => onSelect(record)}
        >
          <span className="visit-avatar green">{getInitials(record.name)}</span>
          <span className="student-info">
            <strong>{record.name}</strong>
            <small>
              {getRecordId(record) || 'No ID'}
              {record.course ? ` · ${record.course}` : ''}
              {record.yearLevel ? ` · ${record.yearLevel}` : ''}
              {record.section ? ` · ${formatSectionLabel(record.section)}` : ''}
            </small>
          </span>
        </button>
      ))}
    </div>
  )
}

function CollegeDirectory({ branch, colleges, roleLabel, selectedId, onSelect, expandedKeys, autoExpandedKeys, onToggle }) {
  return colleges.map((college) => {
    const key = `${branch}::${createDirectoryKey(college.name)}`
    const isOpen = expandedKeys.has(key) || autoExpandedKeys.has(key)
    return (
      <div className="directory-group directory-college" key={key}>
        <button type="button" className="directory-toggle college-toggle" onClick={() => onToggle(key)} aria-expanded={isOpen}>
          <span className="directory-chevron">{isOpen ? '⌄' : '›'}</span>
          <span className="directory-title">{college.name}</span>
          <span className="directory-count">{formatRecordCount(college.records.length, roleLabel)}</span>
        </button>
        {isOpen && <DirectoryRecordList records={college.records} selectedId={selectedId} onSelect={onSelect} />}
      </div>
    )
  })
}

function StudentCollegeDirectory({ colleges, selectedId, onSelect, expandedKeys, autoExpandedKeys, onToggle }) {
  return colleges.map((college) => {
    const collegeKey = `students::${createDirectoryKey(college.name)}`
    const collegeOpen = expandedKeys.has(collegeKey) || autoExpandedKeys.has(collegeKey)
    return (
      <div className="directory-group directory-college" key={collegeKey}>
        <button type="button" className="directory-toggle college-toggle" onClick={() => onToggle(collegeKey)} aria-expanded={collegeOpen}>
          <span className="directory-chevron">{collegeOpen ? '⌄' : '›'}</span>
          <span className="directory-title">{college.name}</span>
          <span className="directory-count">{formatRecordCount(college.count, 'student')}</span>
        </button>
        {collegeOpen && <div className="directory-children directory-course-list">
          {college.courses.map((course) => {
            const courseKey = `${collegeKey}::${createDirectoryKey(course.name)}`
            const courseOpen = expandedKeys.has(courseKey) || autoExpandedKeys.has(courseKey)
            return <div className="directory-group" key={courseKey}>
              <button type="button" className="directory-toggle course-toggle" onClick={() => onToggle(courseKey)} aria-expanded={courseOpen}>
                <span className="directory-chevron">{courseOpen ? '⌄' : '›'}</span>
                <span className="directory-title">{course.name}</span>
                <span className="directory-count">{formatRecordCount(course.count, 'student')}</span>
              </button>
              {courseOpen && <div className="directory-children directory-year-list">
                {course.years.map((year) => {
                  const yearKey = `${courseKey}::${createDirectoryKey(year.name)}`
                  const yearOpen = expandedKeys.has(yearKey) || autoExpandedKeys.has(yearKey)
                  return <div className="directory-group" key={yearKey}>
                    <button type="button" className="directory-toggle year-toggle" onClick={() => onToggle(yearKey)} aria-expanded={yearOpen}>
                      <span className="directory-chevron">{yearOpen ? '⌄' : '›'}</span>
                      <span className="directory-title">{year.name}</span>
                      <span className="directory-count">{formatRecordCount(year.records.length, 'student')}</span>
                    </button>
                    {yearOpen && <DirectoryRecordList records={year.records} selectedId={selectedId} onSelect={onSelect} />}
                  </div>
                })}
              </div>}
            </div>
          })}
        </div>}
      </div>
    )
  })
}

function labelText(text, required = false) {
  return <span className="field-label-text">{text} {required && <RequiredMark />}</span>
}

function validateRequiredFields(data, rules) {
  const errors = rules.reduce((currentErrors, rule) => {
    if (rule.when && !rule.when(data)) return currentErrors
    if (!String(data[rule.field] ?? '').trim()) {
      currentErrors[rule.field] = `${rule.label} is required.`
    }
    return currentErrors
  }, {})

  cpNumberFields.forEach((field) => {
    const value = String(data[field] ?? '').trim()
    if (value && value.length !== 11) {
      errors[field] = 'CP number must be exactly 11 digits.'
    }
  })

  if (
    data.covidVaccination === 'yes' &&
    ![data.covidFirstDose, data.covidSecondDose, data.covidBooster1, data.covidBooster2].some((value) =>
      String(value ?? '').trim()
    )
  ) {
    errors.covidFirstDose = 'Enter at least one vaccination date.'
  }

  return errors
}

function normalizeCpNumber(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 11)
}

function getCurrentSentHomeParts() {
  const now = new Date()
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  const currentDateTime = offsetDate.toISOString().slice(0, 16)
  return {
    sentHomeDate: offsetDate.toISOString().slice(0, 10),
    sentHomeTime: offsetDate.toISOString().slice(11, 16),
    dischargedAt: currentDateTime,
  }
}

function getRecordId(record) {
  return record.studentId || record.employeeId || ''
}

function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function visitBelongsToRecord(record, visit) {
  if (record.id && visit.patientRecordId) return String(record.id) === String(visit.patientRecordId)
  const recordId = getRecordId(record)
  const visitId = getRecordId(visit)
  if (recordId && visitId) return normalizeValue(recordId) === normalizeValue(visitId)
  return normalizeValue(record.name) === normalizeValue(visit.name)
}

function mergeRecord(record = {}) {
  return {
    ...personalDefaults,
    ...withNameParts(record),
    healthConditions: Array.isArray(record.healthConditions) ? record.healthConditions : [],
  }
}

function escapeDoc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function splitNameParts(name = '') {
  const value = String(name).trim()
  const commaParts = value.split(',')
  if (commaParts.length > 1) {
    const givenParts = commaParts.slice(1).join(',').trim().split(/\s+/).filter(Boolean)
    const hasSeparateMiddleName = givenParts.length > 2
    return {
      lastName: commaParts[0].trim(),
      firstName: hasSeparateMiddleName ? givenParts.slice(0, -1).join(' ') : givenParts.join(' '),
      middleName: hasSeparateMiddleName ? givenParts[givenParts.length - 1] : '',
    }
  }

  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { lastName: '', firstName: '', middleName: '' }
  if (parts.length === 1) return { lastName: parts[0], firstName: '', middleName: '' }
  if (parts.length === 2) return { lastName: parts[1], firstName: parts[0], middleName: '' }
  return {
    lastName: parts[parts.length - 1],
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
  }
}

function cleanNamePart(value = '') {
  return String(value ?? '').trim().replace(/(?:\s*,\s*)+$/, '').trim()
}

function withNameParts(record = {}) {
  const parsedName = splitNameParts(record.name)
  return {
    ...record,
    lastName: cleanNamePart(record.lastName) || parsedName.lastName,
    firstName: cleanNamePart(record.firstName) || parsedName.firstName,
    middleName: cleanNamePart(record.middleName) || parsedName.middleName,
  }
}

function composeName({ lastName = '', firstName = '', middleName = '', name = '' } = {}) {
  const familyName = cleanNamePart(lastName)
  const givenNames = [firstName, middleName].map(cleanNamePart).filter(Boolean).join(' ')
  if (familyName && givenNames) return `${familyName}, ${givenNames}`
  if (familyName) return familyName
  if (givenNames) return givenNames
  return String(name ?? '').trim()
}

function formatDateOnly(value) {
  if (!value) return ''
  const exact = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (exact) return `${exact[2]}/${exact[3]}/${exact[1]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US')
}

function formatTimeOnly(value) {
  if (!value) return ''
  const exact = String(value).trim().match(/(?:[T ]|^)(\d{1,2}):(\d{2})(?::\d{2})?/)
  if (exact) {
    const date = new Date(2000, 0, 1, Number(exact[1]), Number(exact[2]))
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  return String(value)
}

function checked(answer, target) {
  return answer === target ? documentCheckMark : ''
}

function YesNoGroup({ label, value, onChange }) {
  return (
    <div className="yes-no-field">
      <span>{label}</span>
      <div className="segmented">
        <button type="button" className={value === 'yes' ? 'selected' : ''} onClick={() => onChange('yes')}>
          Yes
        </button>
        <button type="button" className={value === 'no' ? 'selected' : ''} onClick={() => onChange('no')}>
          No
        </button>
      </div>
    </div>
  )
}

export default function PersonalDataPage({
  onSignOut,
  onNavigate,
  onOpenAccountSettings,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onCloseMobileSidebar,
}) {
  const [activeNav, setActiveNav] = useState('Personal Data')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState(() => getCachedArray('patientRecords'))
  const [visits, setVisits] = useState(() => getCachedArray('visits'))
  const [medicineInventory, setMedicineInventory] = useState(() =>
    getCachedArray('medicines').map(normalizeMedicineItem)
  )
  const [selectedMedicineCategory, setSelectedMedicineCategory] = useState('')
  const [selectedId, setSelectedId] = useState(() => {
    const cachedRecord = getCachedArray('patientRecords')[0]
    return cachedRecord ? String(cachedRecord.id) : ''
  })
  const [form, setForm] = useState(() => {
    const cachedRecord = getCachedArray('patientRecords')[0]
    return cachedRecord ? mergeRecord(cachedRecord) : personalDefaults
  })
  const [recordsLoaded, setRecordsLoaded] = useState(
    () => hasCachedArray('patientRecords') && hasCachedArray('visits')
  )
  const [editingVisit, setEditingVisit] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [visitErrors, setVisitErrors] = useState({})
  const [isImportingDocument, setIsImportingDocument] = useState(false)
  const [isExportingRecord, setIsExportingRecord] = useState(false)
  const [isSavingRecord, setIsSavingRecord] = useState(false)
  const [isSavingVisit, setIsSavingVisit] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [recordTypeFilter, setRecordTypeFilter] = useState('All Records')
  const [expandedDirectory, setExpandedDirectory] = useState(() => new Set(['students', 'employees']))

  const selectedRecord = useMemo(
    () => records.find((record) => String(record.id) === String(selectedId)) || null,
    [records, selectedId]
  )

  const filteredRecords = useMemo(() => {
    if (!query.trim()) return records
    const q = query.toLowerCase()
    return records.filter((record) =>
      [record.name, record.studentId, record.employeeId, record.course, record.department, record.yearLevel, record.section]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    )
  }, [query, records])

  const browsedRecords = useMemo(() => {
    if (recordTypeFilter === 'Students') return filteredRecords.filter((record) => getRecordRole(record) === 'student')
    if (recordTypeFilter === 'Employees') return filteredRecords.filter((record) => getRecordRole(record) !== 'student')
    return filteredRecords
  }, [filteredRecords, recordTypeFilter])

  const recordDirectory = useMemo(() => buildRecordDirectory(browsedRecords), [browsedRecords])

  const autoExpandedDirectoryKeys = useMemo(() => {
    if (!query.trim()) return new Set()
    const keys = new Set(['students', 'employees', 'employees::academic', 'employees::operations', 'employees::academic::instructor', 'employees::operations::admin'])
    recordDirectory.students.colleges.forEach((college) => {
      const collegeKey = `students::${createDirectoryKey(college.name)}`
      if (college.count > 0) keys.add(collegeKey)
      college.courses.forEach((course) => {
        const courseKey = `${collegeKey}::${createDirectoryKey(course.name)}`
        if (course.count > 0) keys.add(courseKey)
        course.years.forEach((year) => {
          if (year.records.length > 0) keys.add(`${courseKey}::${createDirectoryKey(year.name)}`)
        })
      })
    })
    ;[
      ['employees::academic::instructor', recordDirectory.employees.academic.colleges],
      ['employees::operations::admin', recordDirectory.employees.operations.admin.colleges],
    ].forEach(([branch, colleges]) => colleges
      .filter((college) => college.records.length > 0)
      .forEach((college) => keys.add(`${branch}::${createDirectoryKey(college.name)}`)))
    return keys
  }, [query, recordDirectory])

  const recordVisits = useMemo(() => {
    if (!selectedRecord) return []
    return visits
      .filter((visit) => visitBelongsToRecord(selectedRecord, visit))
      .sort((a, b) => new Date(b.visitDateTime || 0) - new Date(a.visitDateTime || 0))
  }, [selectedRecord, visits])

  const medicineOptions = useMemo(
    () =>
      medicineInventory.map((item) => {
        const quantity = Number(item.quantity) || 0
        return {
          name: item.name,
          category: normalizeMedicineCategory(item.category || getDefaultMedicineCategory(item.name)),
          quantity,
          outOfStock: quantity <= 0,
          stockLabel: quantity <= 0 ? 'Out of stock' : `${quantity} left`,
        }
      }),
    [medicineInventory]
  )

  const medicineCategories = useMemo(
    () => [...new Set(medicineOptions.map((medicine) => medicine.category))].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [medicineOptions]
  )

  const medicineCategoryCounts = useMemo(
    () => medicineOptions.reduce((counts, medicine) => ({
      ...counts,
      [medicine.category]: (counts[medicine.category] || 0) + 1,
    }), {}),
    [medicineOptions]
  )

  const visibleMedicineOptions = useMemo(
    () => selectedMedicineCategory
      ? medicineOptions.filter((medicine) => medicine.category === selectedMedicineCategory)
      : medicineOptions,
    [medicineOptions, selectedMedicineCategory]
  )

  const refreshData = useCallback(async () => {
    const [recordsResponse, visitsResponse, medicinesResponse] = await Promise.all([
      clinicApi.getPatientRecords(),
      clinicApi.getVisits(),
      clinicApi.getMedicines(),
    ])
    setRecords(setCachedArray('patientRecords', recordsResponse.data))
    setVisits(setCachedArray('visits', visitsResponse.data))
    setMedicineInventory(setCachedArray('medicines', medicinesResponse.data).map(normalizeMedicineItem))
    setRecordsLoaded(true)
    const nextSelected = recordsResponse.data.find((record) => String(record.id) === String(selectedId)) || recordsResponse.data[0]
    if (nextSelected) {
      setSelectedId(String(nextSelected.id))
      setForm(mergeRecord(nextSelected))
    }
  }, [selectedId])

  useEffect(() => {
    let ignore = false
    async function loadData() {
      try {
        const [recordsResponse, visitsResponse, medicinesResponse] = await Promise.all([
          clinicApi.getPatientRecords(),
          clinicApi.getVisits(),
          clinicApi.getMedicines(),
        ])
        if (ignore) return
        setRecords(setCachedArray('patientRecords', recordsResponse.data))
        setVisits(setCachedArray('visits', visitsResponse.data))
        setMedicineInventory(setCachedArray('medicines', medicinesResponse.data).map(normalizeMedicineItem))
        setRecordsLoaded(true)
        if (recordsResponse.data[0]) {
          setSelectedId(String(recordsResponse.data[0].id))
          setForm(mergeRecord(recordsResponse.data[0]))
        }
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load personal data.')
      } finally {
        if (!ignore) setRecordsLoaded(true)
      }
    }
    loadData()
    return () => {
      ignore = true
    }
  }, [])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Personal Data') onNavigate(item)
    },
    [onNavigate]
  )

  function selectRecord(record) {
    setProfileLoading(true)
    setSelectedId(String(record.id))
    setForm(mergeRecord(record))
    setFormErrors({})
    window.setTimeout(() => setProfileLoading(false), 180)
  }

  function resetDirectoryOverrides() {
    setExpandedDirectory(new Set(['students', 'employees']))
  }

  function handleQueryChange(value) {
    setQuery(value)
    resetDirectoryOverrides()
  }

  function handleRecordTypeFilterChange(value) {
    setRecordTypeFilter(value)
    resetDirectoryOverrides()
  }

  function toggleDirectorySection(key) {
    setExpandedDirectory((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: cpNumberFields.has(field) ? normalizeCpNumber(value) : value }))
    setFormErrors((current) => {
      const next = { ...current, [field]: '' }
      conditionalErrorFields[field]?.forEach((errorField) => {
        next[errorField] = ''
      })
      return next
    })
  }

  function updateNamePart(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value }
      return { ...next, name: composeName(next) }
    })
    setFormErrors((current) => ({ ...current, [field]: '', name: '' }))
  }

  function openVisitEditor(visit) {
    setSelectedMedicineCategory('')
    setEditingVisit({
      ...visitDefaults,
      ...visit,
      email: form.email || '',
      concern: visit.signsSymptoms || visit.concern || 'General check-up',
      signsSymptoms: visit.signsSymptoms || visit.concern || '',
      visitDateTime: toLocalDateTimeInputValue(visit.visitDateTime),
      dischargedAt: toLocalDateTimeInputValue(visit.dischargedAt),
      medicines: normalizeMedicineSelections(Array.isArray(visit.medicines) ? visit.medicines : []),
    })
  }

  function updateVisitField(field, value) {
    setEditingVisit((current) => ({ ...current, [field]: value }))
    setVisitErrors((current) => ({ ...current, [field]: '' }))
  }

  function toggleVisitMedicine(medicine) {
    if (medicine.outOfStock) return
    setEditingVisit((current) => {
      const selected = current.medicines.some((item) => getMedicineName(item) === medicine.name)
      return {
        ...current,
        medicines: selected
          ? current.medicines.filter((item) => getMedicineName(item) !== medicine.name)
          : [...current.medicines, { name: medicine.name, quantity: 1 }],
      }
    })
  }

  function updateVisitMedicineQuantity(medicine, value) {
    const requestedQuantity = Number(value)
    setEditingVisit((current) => ({
      ...current,
      medicines: current.medicines.map((item) => {
        if (getMedicineName(item) !== medicine.name) return item
        const maxQuantity = Math.max(1, Number(medicine.quantity) || 1)
        const quantity = Number.isFinite(requestedQuantity)
          ? Math.min(maxQuantity, Math.max(1, Math.floor(requestedQuantity)))
          : 1
        return { name: medicine.name, quantity }
      }),
    }))
  }

  function updateVisitSentHome(checked) {
    setEditingVisit((current) => {
      if (checked) {
        const sentHomeParts = getCurrentSentHomeParts()
        return {
          ...current,
          sentHome: true,
          ...sentHomeParts,
          dischargedAt: current.dischargedAt || sentHomeParts.dischargedAt,
        }
      }

      const autoDischargedAt =
        current.sentHomeDate && current.sentHomeTime ? `${current.sentHomeDate}T${current.sentHomeTime}` : ''

      return {
        ...current,
        sentHome: false,
        sentHomeDate: '',
        sentHomeTime: '',
        dischargedAt: current.dischargedAt === autoDischargedAt ? '' : current.dischargedAt,
      }
    })
    setVisitErrors((current) => ({
      ...current,
      sentHomeDate: '',
      sentHomeTime: '',
    }))
  }

  function toggleCondition(condition) {
    setForm((current) => {
      const selected = current.healthConditions.includes(condition)
      return {
        ...current,
        healthConditions: selected
          ? current.healthConditions.filter((item) => item !== condition)
          : [...current.healthConditions, condition],
      }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedRecord) return

    const errors = validateRequiredFields(form, personalRequiredFields)
    setFormErrors(errors)
    if (Object.keys(errors).length) {
      setNotice('Please complete the required personal data fields.')
      return
    }

    try {
      setIsSavingRecord(true)
      const payload = { ...form, name: composeName(form) }
      const { data } = await clinicApi.updatePatientRecord(selectedRecord.id, payload)
      setRecords((current) => {
        const nextRecords = current.map((record) => (record.id === data.id ? data : record))
        setCachedArray('patientRecords', nextRecords)
        return nextRecords
      })
      setForm(mergeRecord(data))
      setNotice(`${data.name}'s personal data has been saved.`)
    } catch (error) {
      setNotice(error.message || 'Unable to save personal data.')
    } finally {
      setIsSavingRecord(false)
    }
  }

  async function handleVisitSubmit(e) {
    e.preventDefault()
    if (!selectedRecord || !editingVisit) return

    const errors = editingVisit.sentHome
      ? validateRequiredFields(editingVisit, [
          { field: 'sentHomeDate', label: 'Sent home date' },
          { field: 'sentHomeTime', label: 'Sent home time' },
        ])
      : {}
    setVisitErrors(errors)
    if (Object.keys(errors).length) {
      setNotice('Please enter the sent home date and time.')
      return
    }

    try {
      setIsSavingVisit(true)
      const payload = {
        ...selectedRecord,
        ...editingVisit,
        patientRecordId: selectedRecord.id,
        concern: editingVisit.signsSymptoms || 'General check-up',
        name: composeName(form) || selectedRecord.name,
        position: form.position || selectedRecord.position || 'Student',
        department: form.department || selectedRecord.department || '',
        studentId: form.studentId || selectedRecord.studentId || '',
        employeeId: form.employeeId || selectedRecord.employeeId || '',
        course: form.course || selectedRecord.course || '',
        yearLevel: form.yearLevel || selectedRecord.yearLevel || '',
        section: form.section || selectedRecord.section || '',
        contact: form.contact || selectedRecord.contact || '',
        address: form.address || selectedRecord.address || '',
        medicationFirstAid: formatMedicineSelection(editingVisit.medicines),
      }
      const { data, sentHomeNotification } = await clinicApi.updateVisit(editingVisit.id, payload)
      setVisits((current) => {
        const nextVisits = current.map((visit) => (visit.id === data.id ? data : visit))
        setCachedArray('visits', nextVisits)
        return nextVisits
      })
      setEditingVisit(null)
      const notificationStatus = sentHomeNotification?.status
      if (notificationStatus === 'sent') {
        setNotice('Clinic visit updated. Sent-home email notification sent.')
      } else if (notificationStatus === 'missing_email') {
        setNotice('Clinic visit updated, but no sent-home email was sent because no email address was entered.')
      } else if (notificationStatus === 'failed') {
        setNotice('Clinic visit updated, but the sent-home email could not be sent.')
      } else {
        setNotice('Clinic visit has been updated.')
      }
    } catch (error) {
      setNotice(error.message || 'Unable to update clinic visit.')
    } finally {
      setIsSavingVisit(false)
    }
  }

  async function handleImportDocument(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    if (files.length > 2) {
      setNotice('Please choose no more than two document or image files.')
      return
    }

    const extensions = files.map((file) => file.name.split('.').pop()?.toLowerCase())
    const supportedExtensions = ['doc', 'docx', 'html', 'htm', 'jpg', 'jpeg', 'png', 'webp', 'bmp']
    if (extensions.some((ext) => !supportedExtensions.includes(ext))) {
      setNotice('Please choose up to two Word document or image files.')
      return
    }

    setIsImportingDocument(true)
    try {
      const { data } = await clinicApi.importPatientRecordDocument(files)
      setFormErrors({})
      await refreshData()
      const summary = data.summary || {}
      setNotice(
        `Import complete: ${summary.imported || 0} imported, ${summary.updated || 0} updated, ${summary.visitsCreated || 0} visits added.`
      )
    } catch (error) {
      setNotice(error.message || 'Unable to import these document images.')
    } finally {
      setIsImportingDocument(false)
    }
  }

  async function handleExportDocument() {
    if (!selectedRecord) {
      setNotice('Please select a personal record to export.')
      return
    }

    setIsExportingRecord(true)
    await new Promise((resolve) => requestAnimationFrame(resolve))

    try {
    const data = { ...selectedRecord, ...form, name: composeName(form) }
    const nameParts = {
      lastName: data.lastName || '',
      firstName: data.firstName || '',
      middleName: data.middleName || '',
    }
    const courseYearGrade = [data.course, data.yearLevel].filter(Boolean).join(' / ')
    const latestSentHomeVisit = recordVisits.find((visit) => visit.sentHome) || recordVisits[0] || {}
    const exportVisits = [...recordVisits].sort(
      (a, b) => new Date(a.visitDateTime || 0) - new Date(b.visitDateTime || 0)
    )
    // Keep the original nine blank lines for a new record, but never omit an
    // existing visit when the record has grown beyond one printed page.
    const clinicRows = Array.from({ length: Math.max(9, exportVisits.length) }, (_, index) => {
      const visit = exportVisits[index] || {}
      return `<tr>
        <td>${escapeDoc(formatDateOnly(visit.visitDateTime))}</td>
        <td>${escapeDoc(visit.temperature)}</td>
        <td>${escapeDoc(visit.height)}</td>
        <td>${escapeDoc(visit.weight)}</td>
        <td>${escapeDoc(visit.bloodPressure)}</td>
        <td>${escapeDoc(visit.respiratoryRate)}</td>
        <td>${escapeDoc(visit.pulseRate)}</td>
        <td>${escapeDoc(visit.oxygenSaturation)}</td>
        <td>${escapeDoc(displayClinicVisitRemarks(visit.clinicVisitRemarks))}</td>
      </tr>`
    }).join('')
    // Each clinic-visit row has a matching notes table.  The previous fixed
    // count of three caused later visits to be exported without their signs,
    // symptoms, medication, and remarks.
    const noteBlocks = Array.from({ length: Math.max(3, exportVisits.length) }, (_, index) => {
      const visit = exportVisits[index] || {}
      return `<table class="notes-block">
        <colgroup>
          <col class="date-col">
          <col class="complaint-col">
          <col class="remarks-col">
        </colgroup>
        <tr><th class="date-col">DATE</th><th>SIGNS AND SYMPTOMS/MAJOR COMPLAIN</th><th class="remarks-col">SIGNS AND SYMPTOMS REMARKS</th></tr>
        <tr><td>${escapeDoc(formatDateOnly(visit.visitDateTime))}</td><td>${escapeDoc(visit.signsSymptoms || visit.concern)}</td><td class="remarks-cell">${escapeDoc(visit.visitRemarks)}</td></tr>
        <tr><th colspan="2">MEDICATION/FIRST AID PROVIDED</th><th class="remarks-col">REMARKS</th></tr>
        <tr><td colspan="2">${escapeDoc(visit.medicationFirstAid || (visit.medicines || []).join(', '))}</td><td class="remarks-cell">${escapeDoc(visit.medicationRemarks)}</td></tr>
      </table>`
    }).join('')

    const html = `<!doctype html>
<html> 
<head> 
  <meta charset="utf-8"> 
  <style> 
    @page { size: 8.5in 13in; margin: 0.3in; } 
    body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 9.5pt; line-height: 1.15; } 
    .page { page-break-after: always; min-height: 12in; } 
     
    /* Header Styles */ 
    .header { text-align: center; margin-bottom: 12px; } 
    .header h1 { margin: 0; font-size: 11pt; font-weight: bold; text-transform: uppercase; } 
    .header h2 { margin: 1px 0 0; font-size: 10pt; font-weight: bold; text-decoration: underline; } 
     
    /* Section Headings */ 
    h3 { margin: 10px 0 6px; font-size: 9.5pt; font-weight: bold; text-transform: uppercase; } 
     
    /* Form Lines & Tables */ 
    .line-row { width: 100%; border-collapse: collapse; table-layout: auto; margin-bottom: 3px; } 
    .line-row td { vertical-align: bottom; padding: 1px 0; } 
    .label { width: 1%; white-space: nowrap; font-weight: bold; font-size: 8.5pt; padding-right: 3px; } 
    .line { border-bottom: 1px solid #000; padding: 0 4px; font-size: 9.5pt; vertical-align: baseline; text-align: left; } 
    .line-value { display: block; width: 100%; min-height: 1.15em; line-height: 1.15; text-align: left; } 
    .name-row .label { width: 52px; } 
    .name-row .line { width: 28%; } 
    /* Questions Section */ 
    .instruction { font-size: 8.5pt; font-style: italic; margin: 10px 0 6px; } 
    .questions { width: 100%; border-collapse: collapse; } 
    .questions td { vertical-align: top; padding: 2px 2px; font-size: 8.5pt; } 
    .qnum { width: 18px; font-weight: bold; } 
    .check { width: 45px; text-align: center; border-bottom: 1px solid #000; font-weight: bold; font-size: 9pt; } 
    .yn { text-align: center; font-weight: bold; font-size: 8.5pt; padding-bottom: 4px; } 
    .inline-line { display: inline-flex; align-items: baseline; justify-content: flex-start; min-width: 180px; border-bottom: 1px solid #000; line-height: 1.15; text-align: left; } 
    .condition { display: inline-block; width: 30%; font-size: 8pt; margin-top: 2px; } 
     
    /* Signature */ 
    .sig { margin-top: 25px; text-align: right; } 
    .sig span { display: inline-flex; align-items: baseline; justify-content: flex-start; min-width: 200px; border-bottom: 1px solid #000; line-height: 1.15; text-align: left; } 
    .sig small { display: block; text-align: right; font-size: 7.5pt; margin-top: 2px; padding-right: 15px; } 
     
    /* Clinic & Notes Tables */ 
    .clinic-title { margin: 12px 0 4px; font-weight: bold; font-size: 9.5pt; text-transform: uppercase; } 
    .clinic-table, .notes-block { width: 100%; border-collapse: collapse; table-layout: fixed; } 
    .clinic-table th, .clinic-table td, .notes-block th, .notes-block td { border: 1px solid #000; padding: 3px; vertical-align: top; font-size: 8.5pt; } 
    .clinic-table th, .notes-block th { text-align: center; font-weight: bold; background-color: #f8f8f8; } 

    .notes-block th,
    .notes-block td {
      box-sizing: border-box;
    }

    .notes-block .date-col { width: 14%; }
    .notes-block .complaint-col { width: 56%; }
    .notes-block .remarks-col,
    .notes-block .remarks-cell { width: 30%; }

    /* CLINIC VISITS TABLE ONLY */
    .clinic-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .clinic-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .clinic-table th,
    .clinic-table td {
      box-sizing: border-box;
    }

    .clinic-table td {
      text-align: center;
      height: 16px;
      padding: 2px;
    }

    .clinic-table td:last-child,
    .clinic-table th:last-child {
      text-align: left;
    }

    /* EXACT COLUMN WIDTHS - TOTAL = 100% */
    .clinic-table th:nth-child(1),
    .clinic-table td:nth-child(1) {
      width: 12%;
    }

    .clinic-table th:nth-child(2),
    .clinic-table td:nth-child(2) {
      width: 8%;
    }

    .clinic-table th:nth-child(3),
    .clinic-table td:nth-child(3) {
      width: 8%;
    }

    .clinic-table th:nth-child(4),
    .clinic-table td:nth-child(4) {
      width: 8%;
    }

    .clinic-table th:nth-child(5),
    .clinic-table td:nth-child(5) {
      width: 10%;
    }

    .clinic-table th:nth-child(6),
    .clinic-table td:nth-child(6) {
      width: 6%;
    }

    .clinic-table th:nth-child(7),
    .clinic-table td:nth-child(7) {
      width: 6%;
    }

    .clinic-table th:nth-child(8),
    .clinic-table td:nth-child(8) {
      width: 12%;
    }

    .clinic-table th:nth-child(9),
    .clinic-table td:nth-child(9) {
      width: 30%;
    }
     
    .name-line { margin-bottom: 8px; font-size: 9pt; } 
    .name-line span { display: inline-flex; align-items: baseline; justify-content: flex-start; min-width: 300px; border-bottom: 1px solid #000; padding: 0 4px; line-height: 1.15; text-align: left; } 
     
    .notes-block td { height: 65px; } 
     
    /* Footer Elements */ 
    .footer-lines { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 8.5pt; } 
    .short-line { display: inline-flex; align-items: baseline; justify-content: flex-start; min-width: 60px; border-bottom: 1px solid #000; line-height: 1.15; text-align: left; } 
    .physician-line { display: inline-flex; align-items: baseline; justify-content: flex-start; min-width: 180px; border-bottom: 1px solid #000; line-height: 1.15; text-align: left; } 
    .physician-label { display: block; text-align: center; font-size: 8pt; } 

    @media print {
      .clinic-table {
        width: 100% !important;
        table-layout: fixed !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .clinic-table tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .clinic-table th,
      .clinic-table td {
        box-sizing: border-box !important;
      }
    }
  </style> 
</head> 
<body> 
 
  <!-- PAGE 1 --> 
  <div class="page"> 
    <div class="header"> 
      <h1>Interworld Colleges Foundation Inc</h1> 
      <h2>Health Record</h2> 
    </div> 
 
    <h3>PERSONAL DATA:</h3> 
    <table class="line-row name-row"> 
      <tr> 
        <td class="label">NAME:</td> 
        <td class="line"><span class="line-value">${escapeDoc(nameParts.lastName)}</span></td> 
        <td class="line"><span class="line-value">${escapeDoc(nameParts.firstName)}</span></td> 
        <td class="line"><span class="line-value">${escapeDoc(nameParts.middleName)}</span></td> 
      </tr> 
    </table> 
 
    <table class="line-row"> 
      <tr> 
        <td class="label">COURSE/YR/ GRADE:</td> 
        <td class="line"><span class="line-value">${escapeDoc(courseYearGrade)}</span></td> 
        <td class="label">SECTION:</td> 
        <td class="line" style="width: 40px;"><span class="line-value">${escapeDoc(data.section)}</span></td> 
        <td class="label">GENDER:</td> 
        <td class="line" style="width: 60px;"><span class="line-value">${escapeDoc(data.gender)}</span></td> 
      </tr> 
    </table> 
 
    <table class="line-row"> 
      <tr> 
        <td class="label">DATE OF BIRTH:</td> 
        <td class="line"><span class="line-value">${escapeDoc(formatDateOnly(data.birthdate))}</span></td> 
        <td class="label">PLACE OF BIRTH:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.placeOfBirth)}</span></td> 
      </tr> 
    </table> 
 
    <table class="line-row"> 
      <tr> 
        <td class="label">FATHER'S NAME:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.fatherName)}</span></td> 
        <td class="label">OCCUPATION:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.fatherOccupation)}</span></td> 
      </tr> 
    </table> 
 
    <table class="line-row"> 
      <tr> 
        <td class="label">MOTHER'S NAME:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.motherName)}</span></td> 
        <td class="label">OCCUPATION:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.motherOccupation)}</span></td> 
      </tr> 
    </table> 
 
    <table class="line-row"> 
      <tr> 
        <td class="label">HOME ADDRESS:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.address)}</span></td> 
      </tr> 
    </table> 
 
    <table class="line-row"> 
      <tr> 
        <td class="label">EMERGENCY CONTACT PERSON:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.emergencyContactName)}</span></td> 
        <td class="label">TEL/CP NO:</td> 
        <td class="line" style="width: 120px;"><span class="line-value">${escapeDoc(data.emergencyContactPhone)}</span></td> 
      </tr> 
    </table> 
 
    <table class="line-row"> 
      <tr> 
        <td class="label">EMERGENCY CONTACT PERSON:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.emergencyContactName2)}</span></td> 
        <td class="label">TEL/CP NO:</td> 
        <td class="line" style="width: 120px;"><span class="line-value">${escapeDoc(data.emergencyContactPhone2)}</span></td> 
      </tr> 
    </table> 
 
    <table class="line-row"> 
      <tr> 
        <td class="label">BLOOD TYPE:</td> 
        <td class="line" style="width: 50px;"><span class="line-value">${escapeDoc(data.bloodType)}</span></td> 
        <td class="label">MOBILE NO:</td> 
        <td class="line"><span class="line-value">${escapeDoc(data.contact)}</span></td> 
      </tr> 
    </table> 
 
    <div class="instruction">Please put a check (&#10003;) mark that corresponds to your answer</div> 
 
    <table class="questions"> 
      <tr> 
        <td></td> 
        <td></td> 
        <td class="yn">YES</td> 
        <td class="yn">NO</td> 
      </tr> 
      <tr> 
        <td class="qnum">1.</td> 
        <td>Do you have a complete immunization?<br>If NO, please specify what immunization did you miss? <span class="inline-line">${escapeDoc(data.missedImmunization)}</span></td> 
        <td class="check">${checked(data.completeImmunization, 'yes')}</td> 
        <td class="check">${checked(data.completeImmunization, 'no')}</td> 
      </tr> 
      <tr> 
        <td class="qnum">2.</td> 
        <td>Do you have medical condition that may affect your treatment in medical emergency?<br>If YES, please specify: <span class="inline-line">${escapeDoc(data.medicalConditionDetails)}</span></td> 
        <td class="check">${checked(data.medicalCondition, 'yes')}</td> 
        <td class="check">${checked(data.medicalCondition, 'no')}</td> 
      </tr> 
      <tr> 
        <td class="qnum">3.</td> 
        <td>Have you been hospitalized?<br>If YES, please specify: <span class="inline-line">${escapeDoc(data.hospitalizationDetails)}</span></td> 
        <td class="check">${checked(data.hospitalized, 'yes')}</td> 
        <td class="check">${checked(data.hospitalized, 'no')}</td> 
      </tr> 
      <tr> 
        <td class="qnum">4.</td> 
        <td>Do you have allergy? If YES, please specify what cause/s: <span class="inline-line">${escapeDoc(data.allergyDetails)}</span></td> 
        <td class="check">${checked(data.allergy, 'yes')}</td> 
        <td class="check">${checked(data.allergy, 'no')}</td> 
      </tr> 
      <tr> 
        <td class="qnum">5.</td> 
        <td>Do you have covid vaccination?<br>1st Dose <span class="inline-line" style="min-width:70px;">${escapeDoc(formatDateOnly(data.covidFirstDose))}</span> 2nd Dose <span class="inline-line" style="min-width:70px;">${escapeDoc(formatDateOnly(data.covidSecondDose))}</span> Booster <span class="inline-line" style="min-width:70px;">${escapeDoc(formatDateOnly(data.covidBooster1))}</span> 1 <span class="inline-line" style="min-width:70px;">${escapeDoc(formatDateOnly(data.covidBooster2))}</span> 2</td> 
        <td class="check">${checked(data.covidVaccination, 'yes')}</td> 
        <td class="check">${checked(data.covidVaccination, 'no')}</td> 
      </tr> 
      <tr> 
        <td class="qnum">6.</td> 
        <td>Any pre-existing health conditions?<br> 
          ${conditionOptions.map((condition) => `<span class="condition">${data.healthConditions?.includes(condition) ? documentCheckMark : '____'} ${escapeDoc(condition)}</span>`).join('')} 
        </td> 
        <td class="check"></td> 
        <td class="check"></td> 
      </tr> 
      <tr> 
        <td class="qnum">7.</td> 
        <td>Any surgery? If YES, please specify: <span class="inline-line">${escapeDoc(data.surgeryDetails)}</span></td> 
        <td class="check">${checked(data.surgery, 'yes')}</td> 
        <td class="check">${checked(data.surgery, 'no')}</td> 
      </tr> 
      <tr> 
        <td class="qnum">8.</td> 
        <td>Are you taking any medication/maintenance for your illness/illnesses?<br>If YES, please specify all medications: <span class="inline-line">${escapeDoc(data.maintenanceMedications)}</span></td> 
        <td class="check">${checked(data.maintenanceMedication, 'yes')}</td> 
        <td class="check">${checked(data.maintenanceMedication, 'no')}</td> 
      </tr> 
    </table> 
 
    <p style="font-size: 8pt; margin-top: 12px;">This information given above was voluntarily and was based according to the best of my knowledge about my health history.</p> 
     
    <div class="sig"> 
      <span>${escapeDoc(data.signatureName)}</span> 
      <small>Signature over printed name</small> 
    </div> 
  </div> 
 
  <!-- PAGE 2 --> 
  <div class="page"> 
    <div class="clinic-title">CLINIC VISITS</div> 

    <table class="clinic-table"> 
      <tr> 
        <th>DATE</th> 
        <th>TEMP</th> 
        <th>HT</th> 
        <th>WT</th> 
        <th>BP</th> 
        <th>RR</th> 
        <th>PR</th> 
        <th>O2 Sat (%)</th> 
        <th>REMARKS</th> 
      </tr> 

      ${clinicRows} 

    </table> 
 
    <div style="margin-top: 25px;"> 
      <div class="name-line"><b>NAME:</b> <span>${escapeDoc(data.name)}</span></div> 
      ${noteBlocks} 
    </div> 
 
    <table class="footer-lines"> 
      <tr> 
        <td> 
          <b>Sent Home:</b> <span class="short-line">${latestSentHomeVisit.sentHome ? 'Yes' : 'No'}</span>  
          <b>Date:</b> <span class="short-line">${escapeDoc(formatDateOnly(latestSentHomeVisit.sentHomeDate))}</span>  
          <b>Time:</b> <span class="short-line">${escapeDoc(formatTimeOnly(latestSentHomeVisit.sentHomeTime))}</span> 
        </td> 

        <td style="text-align:right;"> 
          <span class="physician-line">${escapeDoc(latestSentHomeVisit.attendingPhysician)}</span> 
          <span class="physician-label">Attending Physician</span> 
        </td> 
      </tr> 
    </table> 
  </div> 
 
</body> 
</html>`
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const safeName = (data.name || 'personal-data').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    anchor.href = url
    anchor.download = `${safeName || 'personal-data'}-health-record.doc`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    setNotice('Personal data document exported.')
    } finally {
    setIsExportingRecord(false)
    }
  }

  return (
    <div className="app-layout">
      {(isSavingRecord || isSavingVisit || profileLoading || isExportingRecord) && (
        <LoadingOverlay
          message={
            isExportingRecord
              ? 'Generating Health Record...'
              : isSavingRecord
              ? 'Saving profile...'
              : isSavingVisit
                ? 'Saving visit...'
                : 'Loading profile...'
          }
        />
      )}
      <Sidebar
        activeNav={activeNav}
        onNavSelect={handleNavSelect}
        onSignOut={onSignOut}
        isOpen={mobileSidebarOpen}
        onClose={onCloseMobileSidebar}
      />

      <main className="main-content">
        <Topbar
          query={query}
          onQueryChange={handleQueryChange}
          onNotification={setNotice}
          onProfile={onOpenAccountSettings}
          onNavigate={onNavigate}
          onMenuClick={onOpenMobileSidebar}
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">HEALTH RECORD</p>
            <h2>Personal Data</h2>
            <p>Maintain personal health records and review clinic visit entries.</p>
          </div>
          <div className="hero-actions">
            <button className="primary-action" onClick={handleExportDocument} disabled={isExportingRecord}>
              <Icon name="download" /> {isExportingRecord ? 'Generating Health Record...' : 'Export Document'}
            </button>
            <label className="primary-action import-document-action">
              <Icon name="download" /> {isImportingDocument ? 'Importing...' : 'Import Document'}
              <input
                type="file"
                accept=".doc,.docx,.html,.htm,.jpg,.jpeg,.png,.webp,.bmp,image/*"
                multiple
                onChange={handleImportDocument}
                disabled={isImportingDocument}
                hidden
              />
            </label>
          </div>
        </section>

        <section className="personal-data-layout">
          <div className="panel personal-roster-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-label blue-text"><Icon name="students" /> RECORDS</p>
                <h3>{recordsLoaded ? `${browsedRecords.length} profiles` : 'Loading profiles...'}</h3>
              </div>
            </div>
            <label className="directory-filter">
              <span>Record Type</span>
              <select value={recordTypeFilter} onChange={(event) => handleRecordTypeFilterChange(event.target.value)}>
                <option>All Records</option>
                <option>Students</option>
                <option>Employees</option>
              </select>
            </label>
            <div className="student-directory">
              {browsedRecords.length === 0 ? <p className="empty-state">No records match your search.</p> : <>
                {recordTypeFilter !== 'Employees' && (() => {
                  const isOpen = expandedDirectory.has('students') || autoExpandedDirectoryKeys.has('students')
                  return <div className="directory-group directory-root">
                    <button type="button" className="directory-toggle root-toggle" onClick={() => toggleDirectorySection('students')} aria-expanded={isOpen}>
                      <span className="directory-chevron">{isOpen ? '⌄' : '›'}</span><span className="directory-title">Students</span><span className="directory-count">{formatRecordCount(recordDirectory.students.count, 'student')}</span>
                    </button>
                    {isOpen && <div className="directory-children"><StudentCollegeDirectory colleges={recordDirectory.students.colleges} selectedId={selectedId} onSelect={selectRecord} expandedKeys={expandedDirectory} autoExpandedKeys={autoExpandedDirectoryKeys} onToggle={toggleDirectorySection} /></div>}
                  </div>
                })()}
                {recordTypeFilter !== 'Students' && (() => {
                  const employeesOpen = expandedDirectory.has('employees') || autoExpandedDirectoryKeys.has('employees')
                  const academicOpen = expandedDirectory.has('employees::academic') || autoExpandedDirectoryKeys.has('employees::academic')
                  const instructorOpen = expandedDirectory.has('employees::academic::instructor') || autoExpandedDirectoryKeys.has('employees::academic::instructor')
                  const operationsOpen = expandedDirectory.has('employees::operations') || autoExpandedDirectoryKeys.has('employees::operations')
                  const adminOpen = expandedDirectory.has('employees::operations::admin') || autoExpandedDirectoryKeys.has('employees::operations::admin')
                  const operations = recordDirectory.employees.operations
                  return <div className="directory-group directory-root">
                    <button type="button" className="directory-toggle root-toggle" onClick={() => toggleDirectorySection('employees')} aria-expanded={employeesOpen}>
                      <span className="directory-chevron">{employeesOpen ? '⌄' : '›'}</span><span className="directory-title">Employees</span><span className="directory-count">{formatRecordCount(recordDirectory.employees.count, 'employee')}</span>
                    </button>
                    {employeesOpen && <div className="directory-children">
                      <div className="directory-group"><button type="button" className="directory-toggle category-toggle" onClick={() => toggleDirectorySection('employees::academic')} aria-expanded={academicOpen}><span className="directory-chevron">{academicOpen ? '⌄' : '›'}</span><span className="directory-title">Academic</span><span className="directory-count">{formatRecordCount(recordDirectory.employees.academic.count, 'instructor')}</span></button>
                        {academicOpen && <div className="directory-children"><div className="directory-group"><button type="button" className="directory-toggle role-toggle" onClick={() => toggleDirectorySection('employees::academic::instructor')} aria-expanded={instructorOpen}><span className="directory-chevron">{instructorOpen ? '⌄' : '›'}</span><span className="directory-title">Instructor</span><span className="directory-count">{formatRecordCount(recordDirectory.employees.academic.count, 'instructor')}</span></button>{instructorOpen && <div className="directory-children"><CollegeDirectory branch="employees::academic::instructor" colleges={recordDirectory.employees.academic.colleges} roleLabel="instructor" selectedId={selectedId} onSelect={selectRecord} expandedKeys={expandedDirectory} autoExpandedKeys={autoExpandedDirectoryKeys} onToggle={toggleDirectorySection} /></div>}</div></div>}
                      </div>
                      <div className="directory-group"><button type="button" className="directory-toggle category-toggle" onClick={() => toggleDirectorySection('employees::operations')} aria-expanded={operationsOpen}><span className="directory-chevron">{operationsOpen ? '⌄' : '›'}</span><span className="directory-title">Non-academic / Operations</span><span className="directory-count">{formatRecordCount(operations.count, 'employee')}</span></button>
                        {operationsOpen && <div className="directory-children"><div className="directory-group"><button type="button" className="directory-toggle role-toggle" onClick={() => toggleDirectorySection('employees::operations::admin')} aria-expanded={adminOpen}><span className="directory-chevron">{adminOpen ? '⌄' : '›'}</span><span className="directory-title">Admin</span><span className="directory-count">{formatRecordCount(operations.admin.count, 'admin')}</span></button>{adminOpen && <div className="directory-children"><CollegeDirectory branch="employees::operations::admin" colleges={operations.admin.colleges} roleLabel="admin" selectedId={selectedId} onSelect={selectRecord} expandedKeys={expandedDirectory} autoExpandedKeys={autoExpandedDirectoryKeys} onToggle={toggleDirectorySection} /></div>}</div>
                          {[['Staff', operations.staff], ['Guard', operations.guards], ['Maintenance', operations.maintenance], ['Other employees', operations.otherEmployees]].map(([label, group]) => <div className="directory-leaf" key={label}><span>{label}</span><span>{formatRecordCount(group.length, 'employee')}</span>{group.length > 0 && <DirectoryRecordList records={group} selectedId={selectedId} onSelect={selectRecord} />}</div>)}
                        </div>}
                      </div>
                    </div>}
                  </div>
                })()}
              </>}
            </div>
          </div>

          <form className="panel health-record-form" onSubmit={handleSubmit} noValidate>
            {!selectedRecord && !recordsLoaded ? (
              <p className="empty-state">Loading personal records...</p>
            ) : !selectedRecord ? (
              <p className="empty-state">No personal records yet. Register a visit first to create one.</p>
            ) : (
              <>
                <div className="health-form-header">
                  <img src="/icf logo.png?v=transparent" alt="Interworld Colleges Foundation" />
                  <div>
                    <h3>Interworld Colleges Foundation Inc</h3>
                    <strong>Health Record</strong>
                  </div>
                </div>

                <div className="health-summary">
                  <span className="visit-avatar green">{getInitials(form.name)}</span>
                  <div>
                    <strong>{form.name || 'Selected profile'}</strong>
                    <small>
                      {getRecordId(form) || 'No ID'}{form.position ? ` - ${form.position}` : ''}
                      {form.course ? ` - ${form.course}` : ''}{form.yearLevel ? ` - ${form.yearLevel}` : ''}
                    </small>
                  </div>
                </div>

                <section className="health-form-section">
                  <h4>School Information</h4>
                  <div className="health-form-grid">
                    <label className={formErrors.lastName || formErrors.name ? 'field-has-error' : ''}>{labelText('Last Name', true)}
                      <input value={form.lastName} onChange={(e) => updateNamePart('lastName', e.target.value)} required />
                      <FieldError message={formErrors.lastName || formErrors.name} />
                    </label>
                    <label className={formErrors.firstName || formErrors.name ? 'field-has-error' : ''}>{labelText('First Name', true)}
                      <input value={form.firstName} onChange={(e) => updateNamePart('firstName', e.target.value)} required />
                      <FieldError message={formErrors.firstName} />
                    </label>
                    <label>
                      Middle Name
                      <input value={form.middleName} onChange={(e) => updateNamePart('middleName', e.target.value)} />
                    </label>
                    <label className={formErrors.position ? 'field-has-error' : ''}>{labelText('Position', true)}
                      <select value={form.position} onChange={(e) => updateField('position', e.target.value)} required>
                        <option value="Student">Student</option>
                        <option value="Staff">Staff</option>
                        <option value="Instructor">Instructor</option>
                        <option value="Guard">Guard</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Admin">Admin</option>
                      </select>
                      <FieldError message={formErrors.position} />
                    </label>
                    <label className={formErrors.studentId ? 'field-has-error' : ''}>{labelText('Student ID')}
                      <input value={form.studentId} onChange={(e) => updateField('studentId', e.target.value)} />
                      <FieldError message={formErrors.studentId} />
                    </label>
                    <label className={formErrors.employeeId ? 'field-has-error' : ''}>{labelText('Employee ID')}
                      <input value={form.employeeId} onChange={(e) => updateField('employeeId', e.target.value)} />
                      <FieldError message={formErrors.employeeId} />
                    </label>
                    <label className={formErrors.department ? 'field-has-error' : ''}>{labelText('Department', true)}
                      <input value={form.department} onChange={(e) => updateField('department', e.target.value)} required />
                      <FieldError message={formErrors.department} />
                    </label>
                    <label className={formErrors.course ? 'field-has-error' : ''}>{labelText('Course / Grade', !form.position || form.position === 'Student')}
                      <input value={form.course} onChange={(e) => updateField('course', e.target.value)} required={!form.position || form.position === 'Student'} />
                      <FieldError message={formErrors.course} />
                    </label>
                    <label>Year Level
                      <input value={form.yearLevel} onChange={(e) => updateField('yearLevel', e.target.value)} />
                    </label>
                    <label>Section
                      <input value={form.section} onChange={(e) => updateField('section', e.target.value)} />
                    </label>
                  </div>
                </section>

                <section className="health-form-section">
                  <h4>Personal Details</h4>
                  <div className="health-form-grid">
                    <label className={formErrors.birthdate ? 'field-has-error' : ''}>{labelText('Date of Birth', true)}
                      <input type="date" value={form.birthdate} onChange={(e) => updateField('birthdate', e.target.value)} required />
                      <FieldError message={formErrors.birthdate} />
                    </label>
                    <label>Place of Birth
                      <input value={form.placeOfBirth} onChange={(e) => updateField('placeOfBirth', e.target.value)} />
                    </label>
                    <label className={formErrors.gender ? 'field-has-error' : ''}>{labelText('Gender', true)}
                      <select value={form.gender} onChange={(e) => updateField('gender', e.target.value)} required>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                      <FieldError message={formErrors.gender} />
                    </label>
                    <label className={formErrors.bloodType ? 'field-has-error' : ''}>{labelText('Blood Type', true)}
                      <input value={form.bloodType} onChange={(e) => updateField('bloodType', e.target.value)} required />
                      <FieldError message={formErrors.bloodType} />
                    </label>
                    <label className={`wide-field${formErrors.address ? ' field-has-error' : ''}`}>{labelText('Home Address', true)}
                      <input value={form.address} onChange={(e) => updateField('address', e.target.value)} required />
                      <FieldError message={formErrors.address} />
                    </label>
                    <label className={formErrors.contact ? 'field-has-error' : ''}>{labelText('Mobile No.', true)}
                      <input value={form.contact} onChange={(e) => updateField('contact', e.target.value)} inputMode="numeric" maxLength="11" pattern="[0-9]{11}" required />
                      <FieldError message={formErrors.contact} />
                    </label>
                    <label>Email
                      <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                    </label>
                  </div>
                </section>

                <section className="health-form-section">
                  <h4>Family and Emergency Contacts</h4>
                  <div className="health-form-grid">
                    <label>Father's Name
                      <input value={form.fatherName} onChange={(e) => updateField('fatherName', e.target.value)} />
                    </label>
                    <label>Father's Occupation
                      <input value={form.fatherOccupation} onChange={(e) => updateField('fatherOccupation', e.target.value)} />
                    </label>
                    <label>Mother's Name
                      <input value={form.motherName} onChange={(e) => updateField('motherName', e.target.value)} />
                    </label>
                    <label>Mother's Occupation
                      <input value={form.motherOccupation} onChange={(e) => updateField('motherOccupation', e.target.value)} />
                    </label>
                    <label className={formErrors.emergencyContactName ? 'field-has-error' : ''}>{labelText('Emergency Contact Person', true)}
                      <input value={form.emergencyContactName} onChange={(e) => updateField('emergencyContactName', e.target.value)} required />
                      <FieldError message={formErrors.emergencyContactName} />
                    </label>
                    <label className={formErrors.emergencyContactPhone ? 'field-has-error' : ''}>{labelText('Tel / CP No.', true)}
                      <input value={form.emergencyContactPhone} onChange={(e) => updateField('emergencyContactPhone', e.target.value)} inputMode="numeric" maxLength="11" pattern="[0-9]{11}" required />
                      <FieldError message={formErrors.emergencyContactPhone} />
                    </label>
                    <label>Emergency Contact Person 2
                      <input value={form.emergencyContactName2} onChange={(e) => updateField('emergencyContactName2', e.target.value)} />
                    </label>
                    <label className={formErrors.emergencyContactPhone2 ? 'field-has-error' : ''}>Tel / CP No. 2
                      <input value={form.emergencyContactPhone2} onChange={(e) => updateField('emergencyContactPhone2', e.target.value)} inputMode="numeric" maxLength="11" pattern="[0-9]{11}" />
                      <FieldError message={formErrors.emergencyContactPhone2} />
                    </label>
                  </div>
                </section>

                <section className="health-form-section">
                  <h4>Health History</h4>
                  <div className="health-question-grid">
                  <YesNoGroup label="Complete immunization" value={form.completeImmunization} onChange={(value) => updateField('completeImmunization', value)} />
                  <label className={formErrors.missedImmunization ? 'field-has-error' : ''}>{labelText('If no, specify missed immunization', form.completeImmunization === 'no')}
                    <input value={form.missedImmunization} onChange={(e) => updateField('missedImmunization', e.target.value)} />
                    <FieldError message={formErrors.missedImmunization} />
                  </label>
                  <YesNoGroup label="Medical condition affecting emergency treatment" value={form.medicalCondition} onChange={(value) => updateField('medicalCondition', value)} />
                  <label className={formErrors.medicalConditionDetails ? 'field-has-error' : ''}>{labelText('If yes, specify', form.medicalCondition === 'yes')}
                    <input value={form.medicalConditionDetails} onChange={(e) => updateField('medicalConditionDetails', e.target.value)} />
                    <FieldError message={formErrors.medicalConditionDetails} />
                  </label>
                  <YesNoGroup label="Hospitalized" value={form.hospitalized} onChange={(value) => updateField('hospitalized', value)} />
                  <label className={formErrors.hospitalizationDetails ? 'field-has-error' : ''}>{labelText('If yes, specify', form.hospitalized === 'yes')}
                    <input value={form.hospitalizationDetails} onChange={(e) => updateField('hospitalizationDetails', e.target.value)} />
                    <FieldError message={formErrors.hospitalizationDetails} />
                  </label>
                  <YesNoGroup label="Allergy" value={form.allergy} onChange={(value) => updateField('allergy', value)} />
                  <label className={formErrors.allergyDetails ? 'field-has-error' : ''}>{labelText('Cause/s', form.allergy === 'yes')}
                    <input value={form.allergyDetails} onChange={(e) => updateField('allergyDetails', e.target.value)} />
                    <FieldError message={formErrors.allergyDetails} />
                  </label>
                  <YesNoGroup label="Covid vaccination" value={form.covidVaccination} onChange={(value) => updateField('covidVaccination', value)} />
                  <div className="dose-grid">
                    <input type="date" value={form.covidFirstDose} onChange={(e) => updateField('covidFirstDose', e.target.value)} title="1st dose" />
                    <input type="date" value={form.covidSecondDose} onChange={(e) => updateField('covidSecondDose', e.target.value)} title="2nd dose" />
                    <input type="date" value={form.covidBooster1} onChange={(e) => updateField('covidBooster1', e.target.value)} title="Booster 1" />
                    <input type="date" value={form.covidBooster2} onChange={(e) => updateField('covidBooster2', e.target.value)} title="Booster 2" />
                    <FieldError message={formErrors.covidFirstDose} />
                  </div>
                  </div>
                </section>

                <section className="health-form-section">
                  <h4>Pre-existing Conditions</h4>
                  <fieldset className="medicine-field">
                    <legend>Conditions</legend>
                    <div className="condition-options">
                      {conditionOptions.map((condition) => (
                        <label key={condition} className="medicine-option">
                          <input
                            type="checkbox"
                            checked={form.healthConditions.includes(condition)}
                            onChange={() => toggleCondition(condition)}
                          />
                          <span>{condition}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </section>

                <section className="health-form-section">
                  <h4>Surgery and Medication</h4>
                  <div className="health-question-grid">
                    <YesNoGroup label="Any surgery" value={form.surgery} onChange={(value) => updateField('surgery', value)} />
                    <label className={formErrors.surgeryDetails ? 'field-has-error' : ''}>{labelText('If yes, specify', form.surgery === 'yes')}
                      <input value={form.surgeryDetails} onChange={(e) => updateField('surgeryDetails', e.target.value)} />
                      <FieldError message={formErrors.surgeryDetails} />
                    </label>
                    <YesNoGroup label="Taking medication / maintenance" value={form.maintenanceMedication} onChange={(value) => updateField('maintenanceMedication', value)} />
                    <label className={formErrors.maintenanceMedications ? 'field-has-error' : ''}>{labelText('All medications', form.maintenanceMedication === 'yes')}
                      <input value={form.maintenanceMedications} onChange={(e) => updateField('maintenanceMedications', e.target.value)} />
                      <FieldError message={formErrors.maintenanceMedications} />
                    </label>
                    <label className="wide-field">Signature over printed name
                      <input value={form.signatureName} onChange={(e) => updateField('signatureName', e.target.value)} />
                    </label>
                  </div>
                </section>

                <div className="detail-actions">
                  <button className="primary-action" type="submit" disabled={isSavingRecord}>
                    <Icon name="clipboard" /> {isSavingRecord ? 'Saving patient...' : 'Save personal data'}
                  </button>
                </div>

                <div className="clinic-visit-table-block">
                  <div className="clinic-visit-heading">
                    <p className="panel-label yellow-text">CLINIC VISITS</p>
                    <small>{recordVisits.length} saved visit{recordVisits.length !== 1 ? 's' : ''}</small>
                  </div>
                  <div className="history-table-wrap">
                    <table className="history-table personal-visit-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Temp</th>
                          <th>HT</th>
                          <th>WT</th>
                          <th>BP</th>
                          <th>RR</th>
                          <th>PR</th>
                          <th>O2 Sat (%)</th>
                          <th>Signs / Major Complaint</th>
                          <th>Clinic Remarks</th>
                          <th>Signs and Symptoms Remarks</th>
                          <th>Medication / First Aid</th>
                          <th>Medication Remarks</th>
                          <th>Sent Home</th>
                          <th>Attending Physician</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recordVisits.length === 0 ? (
                          <tr><td colSpan="16">No clinic visits recorded yet.</td></tr>
                        ) : recordVisits.map((visit) => (
                          <tr key={visit.id}>
                            <td>{formatVisitDate(visit.visitDateTime)}</td>
                            <td>{visit.temperature}</td>
                            <td>{visit.height}</td>
                            <td>{visit.weight}</td>
                            <td>{visit.bloodPressure}</td>
                            <td>{visit.respiratoryRate}</td>
                            <td>{visit.pulseRate}</td>
                            <td>{visit.oxygenSaturation}</td>
                            <td>{visit.signsSymptoms || visit.concern}</td>
                            <td>{displayClinicVisitRemarks(visit.clinicVisitRemarks)}</td>
                            <td>{visit.visitRemarks}</td>
                            <td>{visit.medicationFirstAid || (visit.medicines || []).join(', ')}</td>
                            <td>{visit.medicationRemarks}</td>
                            <td>
                              {visit.sentHome
                                ? [visit.sentHomeDate, visit.sentHomeTime].filter(Boolean).join(' ')
                                : 'No'}
                            </td>
                            <td>{visit.attendingPhysician}</td>
                            <td>
                              <button type="button" className="history-delete" onClick={() => openVisitEditor(visit)}>
                                <Icon name="clipboard" /> Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </form>
        </section>
      </main>

      {editingVisit && (
        <div className="modal-backdrop" onMouseDown={() => setEditingVisit(null)}>
          <form className="visit-modal student-form-modal update-visit-modal" onSubmit={handleVisitSubmit} onMouseDown={(e) => e.stopPropagation()} noValidate>
            <button type="button" className="modal-close" onClick={() => setEditingVisit(null)}>
              <Icon name="close" />
            </button>
            <p className="section-kicker">CLINIC VISIT</p>
            <h2>Edit clinic visit</h2>

            <div className="modal-form-grid">
              <label>
                Date and time
                <input type="datetime-local" value={editingVisit.visitDateTime} onChange={(e) => updateVisitField('visitDateTime', e.target.value)} />
              </label>
              <label>
                Temperature
                <input value={editingVisit.temperature} onChange={(e) => updateVisitField('temperature', e.target.value)} />
              </label>
              <label>
                Height
                <input value={editingVisit.height} onChange={(e) => updateVisitField('height', e.target.value)} />
              </label>
              <label>
                Weight
                <input value={editingVisit.weight} onChange={(e) => updateVisitField('weight', e.target.value)} />
              </label>
              <label>
                BP
                <input value={editingVisit.bloodPressure} onChange={(e) => updateVisitField('bloodPressure', e.target.value)} />
              </label>
              <label>
                RR
                <input value={editingVisit.respiratoryRate} onChange={(e) => updateVisitField('respiratoryRate', e.target.value)} />
              </label>
              <label>
                PR
                <input value={editingVisit.pulseRate} onChange={(e) => updateVisitField('pulseRate', e.target.value)} />
              </label>
              <label>
                O2 Sat (%)
                <input value={editingVisit.oxygenSaturation} onChange={(e) => updateVisitField('oxygenSaturation', e.target.value)} />
              </label>
              <label className="form-field-full">
                Clinic visit remarks
                <textarea value={editingVisit.clinicVisitRemarks} onChange={(e) => updateVisitField('clinicVisitRemarks', e.target.value)} />
              </label>
              <label className="form-field-full">
                Signs and symptoms / major complaint
                <textarea value={editingVisit.signsSymptoms} onChange={(e) => updateVisitField('signsSymptoms', e.target.value)} />
              </label>
              <label className="form-field-full">
                Signs and symptoms remarks
                <textarea value={editingVisit.visitRemarks} onChange={(e) => updateVisitField('visitRemarks', e.target.value)} />
              </label>
              <fieldset className="medicine-field form-field-full">
                <legend>Medication / first aid provided</legend>
                <p>Select the medicine given and enter its quantity. Out-of-stock items are disabled.</p>
                {medicineOptions.length > 0 && (
                  <div className="medicine-category-filters segmented">
                    <button
                      type="button"
                      className={selectedMedicineCategory === '' ? 'selected' : ''}
                      onClick={() => setSelectedMedicineCategory('')}
                    >
                      All ({medicineOptions.length})
                    </button>
                    {medicineCategories.map((category) => (
                      <button
                        type="button"
                        key={category}
                        className={selectedMedicineCategory === category ? 'selected' : ''}
                        onClick={() => setSelectedMedicineCategory(category)}
                      >
                        {category} ({medicineCategoryCounts[category] || 0})
                      </button>
                    ))}
                  </div>
                )}
                <div className="medicine-options">
                  {medicineOptions.length === 0 ? (
                    <span className="medicine-empty">No medicines in inventory yet.</span>
                  ) : visibleMedicineOptions.length === 0 ? (
                    <span className="medicine-empty">No medicine in this category.</span>
                  ) : (
                    visibleMedicineOptions.map((medicine) => {
                      const selectedMedicine = editingVisit.medicines.find(
                        (item) => getMedicineName(item) === medicine.name
                      )
                      const selected = Boolean(selectedMedicine)
                      return (
                        <label
                          key={medicine.name}
                          className={`medicine-option medicine-option-with-quantity${medicine.outOfStock ? ' out-of-stock' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={medicine.outOfStock && !selected}
                            onChange={() => toggleVisitMedicine(medicine)}
                          />
                          <span>
                            {medicine.name}
                            <em className="stock-hint">{medicine.category} - {medicine.stockLabel}</em>
                          </span>
                          {selected && (
                            <input
                              type="number"
                              className="medicine-quantity-input"
                              min="1"
                              max={Math.max(1, medicine.quantity)}
                              value={getMedicineQuantity(selectedMedicine)}
                              onChange={(e) => updateVisitMedicineQuantity(medicine, e.target.value)}
                              aria-label={`${medicine.name} quantity`}
                            />
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              </fieldset>
              <label className="form-field-full">
                Medication remarks
                <textarea value={editingVisit.medicationRemarks} onChange={(e) => updateVisitField('medicationRemarks', e.target.value)} />
              </label>
              <label>
                Time out
                <input type="datetime-local" value={editingVisit.dischargedAt} onChange={(e) => updateVisitField('dischargedAt', e.target.value)} />
              </label>
              <label className="checkbox-line">
                <input type="checkbox" checked={editingVisit.sentHome} onChange={(e) => updateVisitSentHome(e.target.checked)} />
                Sent home
              </label>
              {editingVisit.sentHome && (
                <>
                  <label className="form-field-full">
                    Email for sent-home notification
                    <input
                      type="email"
                      value={editingVisit.email}
                      onChange={(e) => updateVisitField('email', e.target.value)}
                      placeholder="parent or guardian email"
                    />
                  </label>
                  <label className={visitErrors.sentHomeDate ? 'field-has-error' : ''}>
                    {labelText('Sent home date', true)}
                    <input type="date" value={editingVisit.sentHomeDate} onChange={(e) => updateVisitField('sentHomeDate', e.target.value)} required />
                    <FieldError message={visitErrors.sentHomeDate} />
                  </label>
                  <label className={visitErrors.sentHomeTime ? 'field-has-error' : ''}>
                    {labelText('Sent home time', true)}
                    <input type="time" value={editingVisit.sentHomeTime} onChange={(e) => updateVisitField('sentHomeTime', e.target.value)} required />
                    <FieldError message={visitErrors.sentHomeTime} />
                  </label>
                </>
              )}
              <label className="form-field-full">
                Attending physician
                <input value={editingVisit.attendingPhysician} onChange={(e) => updateVisitField('attendingPhysician', e.target.value)} />
              </label>
            </div>

            <button type="submit" className="primary-action form-submit" disabled={isSavingVisit}>
              <Icon name="clipboard" /> {isSavingVisit ? 'Saving...' : 'Save clinic visit'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
