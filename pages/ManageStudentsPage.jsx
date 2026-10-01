import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { getInitials, getStatusTone } from '../src/utils/visitHelpers'
import { getCachedArray, hasCachedArray, setCachedArray } from '../src/utils/clinicDataCache'
import { defaultMedicineInventory } from '../src/data/constants'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import ImportModal from '../src/components/ImportModal'
import ConfirmDialog from '../src/components/ConfirmDialog'
import LoadingOverlay from '../src/components/LoadingOverlay'

const emptyStudentForm = {
  studentId: '',
  employeeId: '',
  name: '',
  lastName: '',
  firstName: '',
  middleName: '',
  position: '',
  department: '',
  course: '',
  yearLevel: '',
  section: '',
  contact: '',
  address: '',
  birthdate: '',
  gender: '',
  placeOfBirth: '',
  fatherName: '',
  fatherOccupation: '',
  motherName: '',
  motherOccupation: '',
  email: '',
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
  sentHome: false,
  sentHomeDate: '',
  sentHomeTime: '',
  attendingPhysician: '',
  dateTime: '',
  concern: '',
  medicines: [],
}

function getMedicineName(item) {
  return typeof item === 'string' ? item : item?.name
}

function getMedicineQuantity(item) {
  const quantity = typeof item === 'string' ? 1 : Number(item?.quantity)
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
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

const MEDICINE_CATEGORIES = [
  'Pain & Fever',
  'Respiratory',
  'Gastrointestinal',
  'Cardiovascular',
  'Allergy',
  'General',
]

const OLD_CATEGORY_MAP = {
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

function normalizeMedicineCategory(category) {
  const value = String(category || '').trim()
  if (!value) return 'General'
  if (MEDICINE_CATEGORIES.includes(value)) return value
  return OLD_CATEGORY_MAP[value] || 'General'
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

const positionOptions = [
  { value: '', label: 'Select position' },
  { value: 'Student', label: 'Student' },
  { value: 'Staff', label: 'Staff' },
  { value: 'Instructor', label: 'Instructor' },
  { value: 'Guard', label: 'Guard' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Admin', label: 'Admin' },
]

const healthConditionOptions = [
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

const departmentCourseOptions = {
  'College of Information and Computer Studies': [
    { value: 'ACT', label: 'ACT' },
    { value: 'BSCS', label: 'BSCS' },
],
  'College of Education': [
    { value: 'BEEd', label: 'BEEd' },
    { value: 'BSEd', label: 'BSEd' },
  ],
  'College of Business and Accountancy': [
    { value: 'BSA', label: 'BSA' },
    { value: 'BSBA', label: 'BSBA' },
  ],
  'College of Criminal Justice Education': [
    { value: 'BSCRIM', label: 'BSCRIM' },
  ],
  'College of Public Administration': [
    { value: 'BPA', label: 'BPA' },
  ],
  'College of Hospitality and Tourism Management': [
    { value: 'BSTM', label: 'BSTM' },
  ],
}

const departmentOptions = [
  { value: '', label: 'Select department' },
  ...Object.keys(departmentCourseOptions).map((department) => ({
    value: department,
    label: department,
  })),
]

const staffDepartmentOptions = [
  ...departmentOptions,
]

const yearLevelOptions = [
  { value: '', label: 'Select year' },
  { value: '1st Year', label: '1st Year' },
  { value: '2nd Year', label: '2nd Year' },
  { value: '3rd Year', label: '3rd Year' },
  { value: '4th Year', label: '4th Year' },
]

const twoYearCourseOptions = yearLevelOptions.filter(
  (option) => !['3rd Year', '4th Year'].includes(option.value)
)

function getYearLevelOptions(course) {
  return course === 'ACT' ? twoYearCourseOptions : yearLevelOptions
}

function getCourseOptions(department) {
  return [
    { value: '', label: 'Select course' },
    ...(departmentCourseOptions[department] || []),
  ]
}

function isStudentPosition(position) {
  return !position || position === 'Student'
}

function isStaffPosition(position) {
  return ['Staff', 'Instructor', 'Guard', 'Maintenance', 'Admin'].includes(position)
}

function isDepartmentlessStaffPosition(position) {
  return ['Staff', 'Guard', 'Maintenance'].includes(position)
}

const patientRequiredFields = [
  { field: 'name', label: 'Full name' },
  { field: 'position', label: 'Position' },
  { field: 'studentId', label: 'Student ID', when: (data) => isStudentPosition(data.position) },
  { field: 'employeeId', label: 'Employee ID', when: (data) => isStaffPosition(data.position) },
  { field: 'department', label: 'Department', when: (data) => !isDepartmentlessStaffPosition(data.position) },
  { field: 'course', label: 'Course', when: (data) => isStudentPosition(data.position) },
  { field: 'yearLevel', label: 'Year level', when: (data) => isStudentPosition(data.position) },
  { field: 'section', label: 'Block / Section', when: (data) => isStudentPosition(data.position) },
  { field: 'birthdate', label: 'Date of birth' },
  { field: 'gender', label: 'Gender' },
  { field: 'bloodType', label: 'Blood type' },
  { field: 'address', label: 'Address' },
  { field: 'contact', label: 'Contact number' },
  { field: 'emergencyContactName', label: 'Emergency contact person' },
  { field: 'emergencyContactPhone', label: 'Emergency contact number' },
  { field: 'missedImmunization', label: 'Missed immunization reason', when: (data) => data.completeImmunization === 'no' },
  { field: 'medicalConditionDetails', label: 'Medical condition details', when: (data) => data.medicalCondition === 'yes' },
  { field: 'hospitalizationDetails', label: 'Hospitalization details', when: (data) => data.hospitalized === 'yes' },
  { field: 'allergyDetails', label: 'Allergy cause/s', when: (data) => data.allergy === 'yes' },
  { field: 'surgeryDetails', label: 'Surgery details', when: (data) => data.surgery === 'yes' },
  { field: 'maintenanceMedications', label: 'Medication / maintenance details', when: (data) => data.maintenanceMedication === 'yes' },
]

const cpNumberFields = new Set(['contact', 'emergencyContactPhone', 'emergencyContactPhone2'])

function RequiredMark() {
  return <span className="text-red-500">*</span>
}

function FieldError({ message }) {
  return message ? <span className="required-helper">{message}</span> : null
}

function PatientTableSkeleton() {
  return (
    <div className="table-skeleton patient-table-skeleton" aria-label="Loading patients">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="student-row skeleton-row" key={index}>
          <span className="visit-avatar skeleton-block skeleton-avatar" />
          <div className="student-info">
            <span className="skeleton-block skeleton-line wide" />
            <span className="skeleton-block skeleton-line medium" />
          </div>
          <span className="skeleton-block skeleton-pill" />
        </div>
      ))}
    </div>
  )
}

function labelText(text, required = false) {
  return <span className="field-label-text">{text} {required && <RequiredMark />}</span>
}

function splitPatientName(name = '') {
  const value = String(name).trim()
  if (!value) return { lastName: '', firstName: '', middleName: '' }

  const commaParts = value.split(',')
  if (commaParts.length > 1) {
    const lastName = commaParts[0].trim()
    const givenParts = commaParts.slice(1).join(',').trim().split(/\s+/).filter(Boolean)
    const hasSeparateMiddleName = givenParts.length > 2
    return {
      lastName,
      firstName: hasSeparateMiddleName ? givenParts.slice(0, -1).join(' ') : givenParts.join(' '),
      middleName: hasSeparateMiddleName ? givenParts[givenParts.length - 1] : '',
    }
  }

  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { lastName: parts[0], firstName: '', middleName: '' }
  if (parts.length === 2) return { lastName: parts[1], firstName: parts[0], middleName: '' }
  return {
    lastName: parts[parts.length - 1],
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
  }
}

function composePatientName({ lastName = '', firstName = '', middleName = '', name = '' } = {}) {
  const familyName = String(lastName ?? '').trim()
  const givenNames = [firstName, middleName].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
  if (familyName && givenNames) return `${familyName}, ${givenNames}`
  if (familyName) return familyName
  if (givenNames) return givenNames
  return String(name ?? '').trim()
}

function withNameParts(record = {}) {
  const parsedName = splitPatientName(record.name)
  return {
    ...record,
    lastName: record.lastName || parsedName.lastName,
    firstName: record.firstName || parsedName.firstName,
    middleName: record.middleName || parsedName.middleName,
  }
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
  return {
    sentHomeDate: offsetDate.toISOString().slice(0, 10),
    sentHomeTime: offsetDate.toISOString().slice(11, 16),
  }
}

function createVisitSubmissionKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `visit-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getRecordId(record) {
  return record.studentId || record.employeeId || ''
}

function normalizeRecordValue(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function getRecordDatabaseId(record) {
  return record?.id || record?.patientRecordId || ''
}

function hasCompatiblePatientDetails(record, visit) {
  const recordName = normalizeRecordValue(record.name)
  const visitName = normalizeRecordValue(visit.name)
  const recordPosition = normalizeRecordValue(record.position || 'Student')
  const visitPosition = normalizeRecordValue(visit.position || 'Student')

  if (recordName && visitName && recordName !== visitName) return false
  if (recordPosition && visitPosition && recordPosition !== visitPosition) return false
  return true
}

function isVisitForRecord(record, visit) {
  const recordDbId = getRecordDatabaseId(record)
  if (recordDbId && visit.patientRecordId) {
    return String(visit.patientRecordId) === String(recordDbId) && hasCompatiblePatientDetails(record, visit)
  }

  const recordId = getRecordId(record)
  const visitId = getRecordId(visit)
  if (recordId && visitId) {
    return normalizeRecordValue(recordId) === normalizeRecordValue(visitId) && hasCompatiblePatientDetails(record, visit)
  }

  return (
    normalizeRecordValue(record.name) === normalizeRecordValue(visit.name) &&
    normalizeRecordValue(record.position || 'Student') === normalizeRecordValue(visit.position || 'Student')
  )
}

function findConflictingRecordById(students, record) {
  const normalizedId = normalizeRecordValue(getRecordId(record))
  if (!normalizedId) return null

  const matchById = students.find((student) =>
    normalizeRecordValue(getRecordId(student)) === normalizedId
  )

  if (!matchById || hasCompatiblePatientDetails(matchById, record)) return null
  return matchById
}

function findMatchingStudent(students, record) {
  const recordId = getRecordId(record)
  const normalizedId = normalizeRecordValue(recordId)
  const normalizedName = normalizeRecordValue(record.name)
  const normalizedPosition = normalizeRecordValue(record.position || 'Student')

  if (normalizedId) {
    const matchById = students.find((student) =>
      normalizeRecordValue(getRecordId(student)) === normalizedId
    )
    if (matchById && hasCompatiblePatientDetails(matchById, record)) return matchById
  }

  if (!normalizedName) return null

  return students.find((student) =>
    normalizeRecordValue(student.name) === normalizedName &&
    normalizeRecordValue(student.position || 'Student') === normalizedPosition
  ) || null
}

function getRecordLabel(record) {
  return record.position === 'Student' || !record.position ? 'Student' : record.position
}

function normalizeStudentForm(form, fallbackId) {
  const position = form.position || ''
  const isStudent = isStudentPosition(position)
  const name = composePatientName(form)

  return {
    studentId: isStudent ? form.studentId.trim() || fallbackId : '',
    employeeId: isStaffPosition(position) ? form.employeeId.trim() || fallbackId : '',
    name,
    lastName: form.lastName.trim(),
    firstName: form.firstName.trim(),
    middleName: form.middleName.trim(),
    position,
    department: form.department || '',
    course: isStudent ? form.course || '' : '',
    yearLevel: isStudent ? form.yearLevel || '' : '',
    section: isStudent ? form.section.trim() : '',
    contact: form.contact.trim(),
    address: form.address.trim(),
    birthdate: form.birthdate,
    gender: form.gender,
    placeOfBirth: form.placeOfBirth.trim(),
    fatherName: form.fatherName.trim(),
    fatherOccupation: form.fatherOccupation.trim(),
    motherName: form.motherName.trim(),
    motherOccupation: form.motherOccupation.trim(),
    email: form.email.trim(),
    emergencyContactName: form.emergencyContactName.trim(),
    emergencyContactPhone: form.emergencyContactPhone.trim(),
    emergencyContactName2: form.emergencyContactName2.trim(),
    emergencyContactPhone2: form.emergencyContactPhone2.trim(),
    bloodType: form.bloodType.trim(),
    completeImmunization: form.completeImmunization,
    missedImmunization: form.missedImmunization.trim(),
    medicalCondition: form.medicalCondition,
    medicalConditionDetails: form.medicalConditionDetails.trim(),
    hospitalized: form.hospitalized,
    hospitalizationDetails: form.hospitalizationDetails.trim(),
    allergy: form.allergy,
    allergyDetails: form.allergyDetails.trim(),
    covidVaccination: form.covidVaccination,
    covidFirstDose: form.covidFirstDose,
    covidSecondDose: form.covidSecondDose,
    covidBooster1: form.covidBooster1,
    covidBooster2: form.covidBooster2,
    healthConditions: form.healthConditions,
    surgery: form.surgery,
    surgeryDetails: form.surgeryDetails.trim(),
    maintenanceMedication: form.maintenanceMedication,
    maintenanceMedications: form.maintenanceMedications.trim(),
    signatureName: form.signatureName.trim(),
  }
}

export default function ManageStudentsPage({
  onSignOut,
  onNavigate,
  onOpenAccountSettings,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onCloseMobileSidebar,
}) {
  const [activeNav, setActiveNav] = useState('Patients')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [registrationStep, setRegistrationStep] = useState('search')
  const [recordQuery, setRecordQuery] = useState('')
  const [showDetail, setShowDetail] = useState(null)
  const [deleteStudent, setDeleteStudent] = useState(null)
  const [editStudent, setEditStudent] = useState(null)
  const [form, setForm] = useState(emptyStudentForm)
  const [formErrors, setFormErrors] = useState({})
  const [editErrors, setEditErrors] = useState({})
  const [isRegisterSaving, setIsRegisterSaving] = useState(false)
  const [isPatientSaving, setIsPatientSaving] = useState(false)
  const [isPatientDeleting, setIsPatientDeleting] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const visitSubmissionKeyRef = useRef('')
  const [selectedMedicineCategory, setSelectedMedicineCategory] = useState('')
  const registerCourseOptions = useMemo(
    () => getCourseOptions(form.department),
    [form.department]
  )
  const registerYearLevelOptions = useMemo(
    () => getYearLevelOptions(form.course),
    [form.course]
  )
  const editCourseOptions = useMemo(
    () => getCourseOptions(editStudent?.department),
    [editStudent?.department]
  )
  const editYearLevelOptions = useMemo(
    () => getYearLevelOptions(editStudent?.course),
    [editStudent?.course]
  )

  const [medicineInventory, setMedicineInventory] = useState(() =>
    getCachedArray('medicines').map(normalizeMedicineItem)
  )
  const [students, setStudents] = useState(() => getCachedArray('patientRecords'))
  const [visits, setVisits] = useState(() => getCachedArray('visits'))
  const [clinicDataLoaded, setClinicDataLoaded] = useState(
    () => hasCachedArray('patientRecords') && hasCachedArray('visits') && hasCachedArray('medicines')
  )
  const [clinicDataLoading, setClinicDataLoading] = useState(true)

  // Derived medicine option list (with stock labels)
  const medicineOptions = useMemo(
    () =>
      medicineInventory.map((item) => {
        const q = Number(item.quantity) || 0
        return {
          name: item.name,
          category: normalizeMedicineCategory(item.category || getDefaultMedicineCategory(item.name)),
          quantity: q,
          outOfStock: q <= 0,
          stockLabel: q <= 0 ? 'Out of stock' : `${q} left`,
        }
      }),
    [medicineInventory]
  )

  const medicineCategories = useMemo(() => {
    return [...new Set(medicineOptions.map((medicine) => medicine.category))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }, [medicineOptions])

  const medicineCategoryCounts = useMemo(() => {
    return medicineOptions.reduce((counts, medicine) => {
      counts[medicine.category] = (counts[medicine.category] || 0) + 1
      return counts
    }, {})
  }, [medicineOptions])

  const visibleMedicineOptions = useMemo(() => {
    if (!selectedMedicineCategory) return medicineOptions
    return medicineOptions.filter((medicine) => medicine.category === selectedMedicineCategory)
  }, [medicineOptions, selectedMedicineCategory])

  const refreshClinicData = useCallback(async () => {
    const [recordsResponse, visitsResponse, medicinesResponse] = await Promise.all([
      clinicApi.getPatientRecords(),
      clinicApi.getVisits(),
      clinicApi.getMedicines(),
    ])

    setStudents(setCachedArray('patientRecords', recordsResponse.data))
    setVisits(setCachedArray('visits', visitsResponse.data))
    setMedicineInventory(setCachedArray('medicines', medicinesResponse.data).map(normalizeMedicineItem))
    setClinicDataLoaded(true)
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadClinicData() {
      setClinicDataLoading(true)
      try {
        const [recordsResponse, visitsResponse, medicinesResponse] = await Promise.all([
          clinicApi.getPatientRecords(),
          clinicApi.getVisits(),
          clinicApi.getMedicines(),
        ])

        if (!ignore) {
          setStudents(setCachedArray('patientRecords', recordsResponse.data))
          setVisits(setCachedArray('visits', visitsResponse.data))
          setMedicineInventory(setCachedArray('medicines', medicinesResponse.data).map(normalizeMedicineItem))
          setClinicDataLoaded(true)
        }
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load clinic records.')
      } finally {
        if (!ignore) {
          setClinicDataLoaded(true)
          setClinicDataLoading(false)
        }
      }
    }

    loadClinicData()
    return () => {
      ignore = true
    }
  }, [])

  // Filtered list based on search query
  const filteredStudents = useMemo(() => {
    if (!query.trim()) return students
    const q = query.toLowerCase()
    return students.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q) ||
        (s.employeeId || '').toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q) ||
        (s.position || '').toLowerCase().includes(q) ||
        (s.course || '').toLowerCase().includes(q)
    )
  }, [students, query])

  const recordMatches = useMemo(() => {
    const q = recordQuery.trim().toLowerCase()
    if (!q) return students.slice(0, 6)

    return students.filter((student) =>
      [
        student.name,
        student.studentId,
        student.employeeId,
        student.position,
        student.department,
        student.course,
        student.yearLevel,
        student.section,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    )
  }, [recordQuery, students])

  // Count stats
  const stats = useMemo(() => {
    const total = students.length
    const courses = new Set(students.map((s) => s.course).filter(Boolean)).size
    const withVisits = students.filter((s) => {
      return visits.some((v) => isVisitForRecord(s, v))
    }).length
    return { total, courses, withVisits }
  }, [students, visits])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Patients') onNavigate(item)
    },
    [onNavigate]
  )

  const setNoticeSafe = useCallback((msg) => setNotice(msg), [])

  const openRegisterModal = useCallback(() => {
    setForm(emptyStudentForm)
    setSelectedMedicineCategory('')
    setRecordQuery(query)
    setRegistrationStep('search')
    visitSubmissionKeyRef.current = createVisitSubmissionKey()
    setShowModal(true)
  }, [query])

  const closeRegisterModal = useCallback(() => {
    setShowModal(false)
    setRegistrationStep('search')
    setRecordQuery('')
    setSelectedMedicineCategory('')
    setForm(emptyStudentForm)
    setFormErrors({})
    setIsRegisterSaving(false)
    visitSubmissionKeyRef.current = ''
  }, [])

  const closeImportModal = useCallback(() => {
    setShowImportModal(false)
  }, [])

  const handleImportComplete = useCallback(
    async (summary) => {
      closeImportModal()
      await refreshClinicData()
      setNotice(
        `Import complete: ${summary.imported || 0} imported, ${summary.updated || 0} updated, ${summary.visitsCreated || 0} visits added, ${summary.duplicates || summary.duplicatesSkipped || 0} duplicates skipped, ${summary.failed || 0} failed.`
      )
    },
    [closeImportModal, refreshClinicData]
  )

  const openBlankVisitForm = useCallback(() => {
    setForm((current) => ({
      ...emptyStudentForm,
      name: recordQuery.trim() || current.name,
      ...splitPatientName(recordQuery.trim() || current.name),
    }))
    setFormErrors({})
    setRegistrationStep('form')
  }, [recordQuery])

  const handleSelectExistingRecord = useCallback((student) => {
    setForm(withNameParts({
      ...emptyStudentForm,
      ...student,
      studentId: student.studentId || '',
      employeeId: student.employeeId || '',
      name: student.name || '',
      position: student.position || 'Student',
      department: student.department || '',
      course: student.course || '',
      yearLevel: student.yearLevel || '',
      section: student.section || '',
      contact: student.contact || '',
      address: student.address || '',
      healthConditions: Array.isArray(student.healthConditions) ? student.healthConditions : [],
      medicines: [],
    }))
    setFormErrors({})
    setRegistrationStep('form')
  }, [])

  const updateRegisterField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: cpNumberFields.has(field) ? normalizeCpNumber(value) : value }))
    setFormErrors((current) => ({ ...current, [field]: '' }))
  }, [])

  const updateRegisterNamePart = useCallback((field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value }
      return { ...next, name: composePatientName(next) }
    })
    setFormErrors((current) => ({ ...current, name: '' }))
  }, [])

  const updateEditField = useCallback((field, value) => {
    setEditStudent((student) => ({ ...student, [field]: cpNumberFields.has(field) ? normalizeCpNumber(value) : value }))
    setEditErrors((current) => ({ ...current, [field]: '' }))
  }, [])

  const updateEditNamePart = useCallback((field, value) => {
    setEditStudent((student) => {
      const next = { ...student, [field]: value }
      return { ...next, name: composePatientName(next) }
    })
    setEditErrors((current) => ({ ...current, name: '' }))
  }, [])

  const updateRegisterSentHome = useCallback((checked) => {
    setForm((current) => ({
      ...current,
      sentHome: checked,
      ...(checked ? getCurrentSentHomeParts() : { sentHomeDate: '', sentHomeTime: '' }),
    }))
    setFormErrors((current) => ({ ...current, sentHomeDate: '', sentHomeTime: '' }))
  }, [])

  const handleHealthConditionToggle = useCallback((condition) => {
    setForm((current) => {
      const selected = current.healthConditions.includes(condition)
      return {
        ...current,
        healthConditions: selected
          ? current.healthConditions.filter((item) => item !== condition)
          : [...current.healthConditions, condition],
      }
    })
  }, [])

  const handleMedicineToggle = useCallback((medicine, outOfStock) => {
    if (outOfStock) return
    setForm((current) => {
      const selected = current.medicines.some((item) => getMedicineName(item) === medicine.name)
      return {
        ...current,
        medicines: selected
          ? current.medicines.filter((item) => getMedicineName(item) !== medicine.name)
          : [...current.medicines, { name: medicine.name, quantity: 1 }],
      }
    })
  }, [])

  const handleMedicineQuantityChange = useCallback((medicine, value) => {
    const requestedQuantity = Number(value)
    setForm((current) => ({
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
  }, [])

  // Register a student and record their clinic visit
  const handleRegister = useCallback(
    async (e) => {
      e.preventDefault()
      if (isRegisterSaving) return
      const fallbackId = `STU-${Date.now().toString(36).toUpperCase()}`
      const draftStudent = normalizeStudentForm(form, '')
      const conflictingStudent = findConflictingRecordById(students, draftStudent)

      if (conflictingStudent) {
        setNotice(
          `${getRecordId(draftStudent)} already belongs to ${conflictingStudent.name}. Please use the correct patient or enter a unique ID.`
        )
        return
      }

      const existingStudent = findMatchingStudent(students, draftStudent)
      const existingRecordId = existingStudent ? getRecordId(existingStudent) : ''
      const submittedStudent = normalizeStudentForm(form, existingRecordId || fallbackId)
      const errors = validateRequiredFields(form, [
        ...patientRequiredFields,
        ...(form.sentHome
          ? [
              { field: 'sentHomeDate', label: 'Sent home date' },
              { field: 'sentHomeTime', label: 'Sent home time' },
            ]
          : []),
      ])

      setFormErrors(errors)
      if (Object.keys(errors).length) {
        setNotice('Please complete the required visit registration fields.')
        return
      }

      const now = new Date()
      if (!visitSubmissionKeyRef.current) {
        visitSubmissionKeyRef.current = createVisitSubmissionKey()
      }

    try {
      setIsRegisterSaving(true)
        const response = await clinicApi.createVisit({
          patientRecordId: existingStudent?.id,
          ...submittedStudent,
          concern: form.signsSymptoms || 'General check-up',
          temperature: form.temperature,
          height: form.height,
          weight: form.weight,
          bloodPressure: form.bloodPressure,
          respiratoryRate: form.respiratoryRate,
          pulseRate: form.pulseRate,
          oxygenSaturation: form.oxygenSaturation,
          signsSymptoms: form.signsSymptoms,
          clinicVisitRemarks: form.clinicVisitRemarks,
          visitRemarks: form.visitRemarks,
          medicationFirstAid: formatMedicineSelection(form.medicines),
          medicationRemarks: form.medicationRemarks,
          sentHome: form.sentHome,
          sentHomeDate: form.sentHomeDate,
          sentHomeTime: form.sentHomeTime,
          attendingPhysician: form.attendingPhysician,
          medicines: form.medicines,
          visitDateTime: form.dateTime || '',
          clientSubmissionKey: visitSubmissionKeyRef.current,
          timestamp: now.getTime(),
        })
        await refreshClinicData()
        closeRegisterModal()
        if (form.sentHome) {
          const notificationStatus = response?.sentHomeNotification?.status
          if (notificationStatus === 'sent' || notificationStatus === 'already_sent') {
            setNotice('Patient sent home successfully. Email notification sent.')
          } else if (notificationStatus === 'missing_email') {
            setNotice('Patient sent home successfully, but no email notification could be sent because the patient has no email address.')
          } else {
            setNotice('Patient sent home successfully, but the email notification could not be sent.')
          }
        } else {
          setNotice(
            existingStudent
              ? `${submittedStudent.name}'s details and visit have been updated.`
              : `${submittedStudent.name} has been registered and their visit has been recorded.`
          )
        }
      } catch (error) {
        setNotice(error.message || 'Unable to save this visit.')
      } finally {
        setIsRegisterSaving(false)
      }
    },
    [closeRegisterModal, form, isRegisterSaving, refreshClinicData, students]
  )

  const handleUpdateStudent = useCallback(
    async (e) => {
      e.preventDefault()
      if (!showDetail || !editStudent) return
      if (isPatientSaving) return

      const originalId = showDetail.studentId
      const originalRecordId = getRecordId(showDetail)
      const position = editStudent.position || 'Student'
      const isStudent = isStudentPosition(position)
      const nextStudent = {
        ...showDetail,
        studentId: isStudent ? editStudent.studentId.trim() || originalId : '',
        employeeId: isStaffPosition(position) ? editStudent.employeeId.trim() || originalRecordId : '',
        name: composePatientName(editStudent),
        lastName: editStudent.lastName.trim(),
        firstName: editStudent.firstName.trim(),
        middleName: editStudent.middleName.trim(),
        position,
        department: editStudent.department || '',
        course: isStudent ? editStudent.course || '' : '',
        yearLevel: isStudent ? editStudent.yearLevel || '' : '',
        section: isStudent ? editStudent.section.trim() : '',
        contact: editStudent.contact.trim(),
        email: editStudent.email?.trim() || '',
        address: editStudent.address.trim(),
        birthdate: editStudent.birthdate || '',
        emergencyContactName: editStudent.emergencyContactName?.trim() || '',
        emergencyContactPhone: editStudent.emergencyContactPhone?.trim() || '',
      }

      const errors = validateRequiredFields(nextStudent, patientRequiredFields)
      setEditErrors(errors)
      if (Object.keys(errors).length) {
        setNotice('Please complete the required profile fields.')
        return
      }

      const nextRecordId = getRecordId(nextStudent)
      const duplicateId = students.some(
        (student) =>
          getRecordId(student) === nextRecordId &&
          getRecordId(student) !== originalRecordId
      )

      if (duplicateId) {
        setNotice('That ID is already used by another record.')
        return
      }

      try {
        setIsPatientSaving(true)
        const { data } = await clinicApi.updatePatientRecord(showDetail.id, nextStudent)
        setStudents((current) => current.map((student) => (student.id === data.id ? data : student)))
        setVisits((current) => current.map((visit) => (
          String(visit.patientRecordId) === String(data.id)
            ? {
                ...visit,
                name: data.name,
                position: data.position,
                department: data.department,
                studentId: data.studentId,
                employeeId: data.employeeId,
                course: data.course,
                yearLevel: data.yearLevel,
                section: data.section,
              }
            : visit
        )))
        setShowDetail(data)
        setEditStudent(withNameParts(data))
        setNotice(`${data.name}'s details have been updated.`)
      } catch (error) {
        setNotice(error.message || 'Unable to update this record.')
      } finally {
        setIsPatientSaving(false)
      }
    },
    [editStudent, isPatientSaving, showDetail, students]
  )

  const handleDeleteStudent = useCallback(async () => {
    if (!deleteStudent) return

    const studentName = deleteStudent.name || 'this student'
    try {
      setIsPatientDeleting(true)
      await clinicApi.deletePatientRecord(deleteStudent.id)
      await refreshClinicData()
      setShowDetail(null)
      setEditStudent(null)
      setDeleteStudent(null)
      setNotice(`${studentName} has been deleted.`)
    } catch (error) {
      setNotice(error.message || 'Unable to delete this record.')
    } finally {
      setIsPatientDeleting(false)
    }
  }, [deleteStudent, refreshClinicData])

  // View student details from a visit click
  const handleViewStudent = useCallback((student) => {
    setProfileLoading(true)
    const editableStudent = withNameParts({
      ...student,
      studentId: student.studentId || '',
      employeeId: student.employeeId || '',
      name: student.name || '',
      position: student.position || 'Student',
      department: student.department || '',
      course: student.course || '',
      yearLevel: student.yearLevel || '',
      section: student.section || '',
      contact: student.contact || '',
      email: student.email || '',
      address: student.address || '',
      birthdate: student.birthdate || '',
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone: student.emergencyContactPhone || '',
    })
    setShowDetail(editableStudent)
    setEditStudent(editableStudent)
    setEditErrors({})
    window.setTimeout(() => setProfileLoading(false), 180)
  }, [])

  // Get visit count for a student
  const getVisitCount = useCallback((record) => {
    return visits.filter((visit) => isVisitForRecord(record, visit)).length
  }, [visits])

  // Red means currently active in the clinic; green means timed out or inactive.
  const getAvatarTone = useCallback((record) => {
    const matchingVisits = visits.filter((visit) => isVisitForRecord(record, visit))
    const activeVisit = matchingVisits.find((visit) => !visit.dischargedAt)
    if (activeVisit) return getStatusTone(activeVisit)
    return 'green'
  }, [visits])

  return (
    <div className="app-layout">
      {(isRegisterSaving || isPatientSaving || profileLoading || isPatientDeleting) && (
        <LoadingOverlay
          message={
            isRegisterSaving
              ? 'Saving visit...'
              : isPatientSaving
                ? 'Saving patient...'
                : isPatientDeleting
                  ? 'Deleting...'
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
          onQueryChange={setQuery}
          onNotification={setNoticeSafe}
          onProfile={onOpenAccountSettings}
          onNavigate={onNavigate}
          onMenuClick={onOpenMobileSidebar}
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">CLINIC RECORDS</p>
            <h2>Manage Records</h2>
            <p>Register students, school staff, and clinic visits.</p>
          </div>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => setShowImportModal(true)}>
              <Icon name="download" /> Import Records
            </button>
            <button className="primary-action" onClick={openRegisterModal}>
              <Icon name="plus" /> Register visit
            </button>
          </div>
        </section>

        {/* Stats row */}
        {students.length > 0 && (
          <section className="stats-grid" aria-label="Student statistics">
            <div className="stat-card blue">
              <span className="stat-icon"><Icon name="students" /></span>
              <div>
                <strong>{stats.total}</strong>
                <p>Total records</p>
                <small>Registered in the system</small>
              </div>
            </div>
            <div className="stat-card green">
              <span className="stat-icon"><Icon name="clipboard" /></span>
              <div>
                <strong>{stats.courses}</strong>
                <p>Courses involved</p>
                <small>Across different programs</small>
              </div>
            </div>
            <div className="stat-card yellow">
              <span className="stat-icon"><Icon name="calendar" /></span>
              <div>
                <strong>{stats.withVisits}</strong>
                <p>With clinic visits</p>
                <small>Have visited the clinic</small>
              </div>
            </div>
            <div className="stat-card red">
              <span className="stat-icon"><Icon name="heart" /></span>
              <div>
                <strong>{students.length > 0 ? Math.round((stats.withVisits / students.length) * 100) : 0}%</strong>
                <p>Visit rate</p>
                <small>Of registered records</small>
              </div>
            </div>
          </section>
        )}

        {/* Record list panel */}
        <section className="students-section">
          <div className="panel students-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-label blue-text"><Icon name="students" /> RECORD ROSTER</p>
                <h3>
                  {query
                    ? `Search results (${filteredStudents.length})`
                    : `All records (${students.length})`}
                </h3>
              </div>
            </div>

            {clinicDataLoading || (students.length === 0 && !clinicDataLoaded) ? (
              <PatientTableSkeleton />
            ) : students.length === 0 ? (
              <p className="empty-state" style={{ marginTop: '32px' }}>
                No records registered yet. Click <strong>Register visit</strong> to add the first one.
              </p>
            ) : filteredStudents.length === 0 ? (
              <p className="empty-state" style={{ marginTop: '32px' }}>
                No records match your search for "{query}".
              </p>
            ) : (
              <div className="student-list">
                {filteredStudents.map((student) => (
                  <button
                    key={getRecordId(student)}
                    className="student-row"
                    onClick={() => handleViewStudent(student)}
                  >
                    <span
                      className={`visit-avatar ${getAvatarTone(student)}`}
                    >
                      {getInitials(student.name)}
                    </span>
                    <div className="student-info">
                      <strong>{student.name}</strong>
                      <small>
                        {getRecordId(student) || 'No ID'}
                        {student.position ? ` - ${getRecordLabel(student)}` : ''}
                        {student.department ? ` - ${student.department}` : ''}
                        {student.course ? ` - ${student.course}` : ''}
                        {student.yearLevel ? ` - ${student.yearLevel}` : ''}
                      </small>
                    </div>
                    <span className="student-visit-count">
                      {getVisitCount(student)} visit
                      {getVisitCount(student) !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions panel */}
          <div className="panel quick-panel">
            <p className="panel-label yellow-text">QUICK ACTIONS</p>
            <h3>Record tasks</h3>
            <div className="quick-actions">
              <button onClick={openRegisterModal}>
                <Icon name="plus" /><span>Register<br />visit</span>
              </button>
              <button onClick={() => setShowImportModal(true)}>
                <Icon name="download" /><span>Import<br />records</span>
              </button>
              <button onClick={() => onNavigate('Dashboard')}>
                <Icon name="chart" /><span>Back to<br />Dashboard</span>
              </button>
              <button onClick={() => onNavigate('Visit history')}>
                <Icon name="history" /><span>View visit<br />history</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Register student and visit modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeRegisterModal}>
          <div className="visit-modal student-form-modal register-student-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeRegisterModal}>
              <Icon name="close" />
            </button>
            <p className="section-kicker">VISIT REGISTRATION</p>
            <h2>{registrationStep === 'search' ? 'Search record first' : 'Register visit'}</h2>

            {registrationStep === 'search' ? (
              <div className="record-search-flow">
                <label className="form-field-full">
                  Search by name, student ID, employee ID, department, or course
                  <input
                    value={recordQuery}
                    onChange={(e) => setRecordQuery(e.target.value)}
                    placeholder="Type a name or ID before registering"
                    autoFocus
                  />
                </label>

                <div className="record-match-list">
                  {recordMatches.length > 0 ? (
                    recordMatches.map((student) => (
                      <button
                        key={getRecordId(student)}
                        className="record-match-row"
                        onClick={() => handleSelectExistingRecord(student)}
                      >
                        <span className={`visit-avatar ${getAvatarTone(student)}`}>
                          {getInitials(student.name)}
                        </span>
                        <span>
                          <strong>{student.name}</strong>
                          <small>
                            {getRecordId(student) || 'No ID'}
                            {student.position ? ` - ${getRecordLabel(student)}` : ''}
                            {student.department ? ` - ${student.department}` : ''}
                            {student.course ? ` - ${student.course}` : ''}
                          </small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="empty-state">No matching records found.</p>
                  )}
                </div>

                <button type="button" className="primary-action form-submit" onClick={openBlankVisitForm}>
                  <Icon name="plus" /> Register new visit
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="modal-form-grid" noValidate>
                <label className={formErrors.name ? 'field-has-error' : ''}>
                  {labelText('Last Name', true)}
                  <input
                    value={form.lastName}
                    onChange={(e) => updateRegisterNamePart('lastName', e.target.value)}
                    placeholder="e.g. Dela Cruz"
                    required
                  />
                </label>
                <label className={formErrors.name ? 'field-has-error' : ''}>
                  {labelText('First Name', true)}
                  <input
                    value={form.firstName}
                    onChange={(e) => updateRegisterNamePart('firstName', e.target.value)}
                    placeholder="e.g. Juan"
                    required
                  />
                </label>
                <label className={formErrors.name ? 'field-has-error' : ''}>
                  Middle Name
                  <input
                    value={form.middleName}
                    onChange={(e) => updateRegisterNamePart('middleName', e.target.value)}
                    placeholder="e.g. Santos"
                  />
                  <FieldError message={formErrors.name} />
                </label>
                <label className={formErrors.position ? 'field-has-error' : ''}>
                  {labelText('Position', true)}
                  <select
                    value={form.position}
                    onChange={(e) => {
                      const position = e.target.value
                      setForm((f) => ({
                        ...f,
                        position,
                        department: isDepartmentlessStaffPosition(position) ? '' : f.department || '',
                        employeeId: isStaffPosition(position) ? f.employeeId : '',
                        studentId: isStudentPosition(position) ? f.studentId : '',
                        course: isStudentPosition(position) ? f.course : '',
                        yearLevel: isStudentPosition(position) ? f.yearLevel : '',
                        section: isStudentPosition(position) ? f.section : '',
                      }))
                      setFormErrors((current) => ({ ...current, position: '', department: '', employeeId: '', studentId: '', course: '' }))
                    }}
                    required
                  >
                    {positionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={formErrors.position} />
                </label>
                {isStudentPosition(form.position) && (
                  <label className={formErrors.department ? 'field-has-error' : ''}>
                    {labelText('Department', true)}
                    <select
                      value={form.department}
                      onChange={(e) => {
                        const department = e.target.value
                        setForm((f) => ({
                          ...f,
                          department,
                          course: departmentCourseOptions[department]?.some((option) => option.value === f.course)
                            ? f.course
                            : '',
                          yearLevel: departmentCourseOptions[department]?.some((option) => option.value === f.course)
                            ? f.yearLevel
                            : '',
                        }))
                        setFormErrors((current) => ({ ...current, department: '' }))
                      }}
                      required
                    >
                      {departmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <FieldError message={formErrors.department} />
                  </label>
                )}
                {!isStudentPosition(form.position) && !isDepartmentlessStaffPosition(form.position) && (
                  <label className={formErrors.department ? 'field-has-error' : ''}>
                    {labelText('Department', true)}
                    <select
                      value={form.department}
                      onChange={(e) => updateRegisterField('department', e.target.value)}
                      required
                    >
                      {staffDepartmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <FieldError message={formErrors.department} />
                  </label>
                )}
                {isStudentPosition(form.position) && (
                  <>
                    <label className={formErrors.course ? 'field-has-error' : ''}>
                      {labelText('Course', true)}
                      <select
                        value={form.course}
                        onChange={(e) => {
                          const course = e.target.value
                          setForm((f) => ({
                            ...f,
                            course,
                            yearLevel:
                              course === 'ACT' &&
                              !twoYearCourseOptions.some((option) => option.value === f.yearLevel)
                                ? ''
                              : f.yearLevel,
                          }))
                          setFormErrors((current) => ({ ...current, course: '' }))
                        }}
                        required
                      >
                        {registerCourseOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <FieldError message={formErrors.course} />
                    </label>
                    <label className={formErrors.studentId ? 'field-has-error' : ''}>
                      {labelText('Student ID', true)}
                      <input
                        value={form.studentId}
                        onChange={(e) => updateRegisterField('studentId', e.target.value)}
                        placeholder="e.g. ICF-2024-001"
                        required
                      />
                      <FieldError message={formErrors.studentId} />
                    </label>
                    <label className={formErrors.yearLevel ? 'field-has-error' : ''}>
                      {labelText('Year level', true)}
                      <select
                        value={form.yearLevel}
                        onChange={(e) => updateRegisterField('yearLevel', e.target.value)}
                        required
                      >
                        {registerYearLevelOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <FieldError message={formErrors.yearLevel} />
                    </label>
                    <label className={formErrors.section ? 'field-has-error' : ''}>
                      {labelText('Block / Section', true)}
                      <input
                        value={form.section}
                        onChange={(e) => updateRegisterField('section', e.target.value)}
                        placeholder="e.g. A"
                        required
                      />
                      <FieldError message={formErrors.section} />
                    </label>
                  </>
                )}
                {!isStudentPosition(form.position) && (
                  <label className={formErrors.employeeId ? 'field-has-error' : ''}>
                    {labelText('Employee ID', true)}
                    <input
                      value={form.employeeId}
                      onChange={(e) => updateRegisterField('employeeId', e.target.value)}
                      placeholder="e.g. EMP-2024-001"
                      required
                    />
                    <FieldError message={formErrors.employeeId} />
                  </label>
                )}
                <label className={formErrors.contact ? 'field-has-error' : ''}>
                  {labelText('Contact number', true)}
                  <input
                    value={form.contact}
                    onChange={(e) => updateRegisterField('contact', e.target.value)}
                    placeholder="e.g. 09123456789"
                    type="tel"
                    inputMode="numeric"
                    maxLength="11"
                    pattern="[0-9]{11}"
                    required
                  />
                  <FieldError message={formErrors.contact} />
                </label>
                <label className={`form-field-full${formErrors.address ? ' field-has-error' : ''}`}>
                  {labelText('Address', true)}
                  <input
                    value={form.address}
                    onChange={(e) => updateRegisterField('address', e.target.value)}
                    placeholder="e.g. Brgy. San Juan, City"
                    required
                  />
                  <FieldError message={formErrors.address} />
                </label>
                <div className="form-section-title form-field-full">Personal data</div>
                <label className={formErrors.birthdate ? 'field-has-error' : ''}>
                  {labelText('Date of birth', true)}
                  <input
                    type="date"
                    value={form.birthdate}
                    onChange={(e) => updateRegisterField('birthdate', e.target.value)}
                    required
                  />
                  <FieldError message={formErrors.birthdate} />
                </label>
                <label>
                  Place of birth
                  <input
                    value={form.placeOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, placeOfBirth: e.target.value }))}
                  />
                </label>
                <label className={formErrors.gender ? 'field-has-error' : ''}>
                  {labelText('Gender', true)}
                  <select
                    value={form.gender}
                    onChange={(e) => updateRegisterField('gender', e.target.value)}
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <FieldError message={formErrors.gender} />
                </label>
                <label className={formErrors.bloodType ? 'field-has-error' : ''}>
                  {labelText('Blood type', true)}
                  <input
                    value={form.bloodType}
                    onChange={(e) => updateRegisterField('bloodType', e.target.value)}
                    placeholder="e.g. O+"
                    required
                  />
                  <FieldError message={formErrors.bloodType} />
                </label>
                <label>
                  Father's name
                  <input
                    value={form.fatherName}
                    onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))}
                  />
                </label>
                <label>
                  Father's occupation
                  <input
                    value={form.fatherOccupation}
                    onChange={(e) => setForm((f) => ({ ...f, fatherOccupation: e.target.value }))}
                  />
                </label>
                <label>
                  Mother's name
                  <input
                    value={form.motherName}
                    onChange={(e) => setForm((f) => ({ ...f, motherName: e.target.value }))}
                  />
                </label>
                <label>
                  Mother's occupation
                  <input
                    value={form.motherOccupation}
                    onChange={(e) => setForm((f) => ({ ...f, motherOccupation: e.target.value }))}
                  />
                </label>
                <label className={formErrors.emergencyContactName ? 'field-has-error' : ''}>
                  {labelText('Emergency contact person', true)}
                  <input
                    value={form.emergencyContactName}
                    onChange={(e) => updateRegisterField('emergencyContactName', e.target.value)}
                    required
                  />
                  <FieldError message={formErrors.emergencyContactName} />
                </label>
                <label className={formErrors.emergencyContactPhone ? 'field-has-error' : ''}>
                  {labelText('Tel / CP no.', true)}
                  <input
                    value={form.emergencyContactPhone}
                    onChange={(e) => updateRegisterField('emergencyContactPhone', e.target.value)}
                    type="tel"
                    inputMode="numeric"
                    maxLength="11"
                    pattern="[0-9]{11}"
                    required
                  />
                  <FieldError message={formErrors.emergencyContactPhone} />
                </label>
                <label>
                  Emergency contact person
                  <input
                    value={form.emergencyContactName2}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyContactName2: e.target.value }))}
                  />
                </label>
                <label>
                  Tel / CP no.
                  <input
                    value={form.emergencyContactPhone2}
                    onChange={(e) => updateRegisterField('emergencyContactPhone2', e.target.value)}
                    type="tel"
                    inputMode="numeric"
                    maxLength="11"
                    pattern="[0-9]{11}"
                  />
                  <FieldError message={formErrors.emergencyContactPhone2} />
                </label>
                <div className="form-section-title form-field-full">Health history</div>
                <label>
                  Complete immunization
                  <select
                    value={form.completeImmunization}
                    onChange={(e) => setForm((f) => ({ ...f, completeImmunization: e.target.value }))}
                  >
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className={formErrors.missedImmunization ? 'field-has-error' : ''}>
                  {labelText('Missed immunization', form.completeImmunization === 'no')}
                  <input
                    value={form.missedImmunization}
                    onChange={(e) => setForm((f) => ({ ...f, missedImmunization: e.target.value }))}
                  />
                  <FieldError message={formErrors.missedImmunization} />
                </label>
                <label>
                  Medical condition for emergency care
                  <select
                    value={form.medicalCondition}
                    onChange={(e) => setForm((f) => ({ ...f, medicalCondition: e.target.value }))}
                  >
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className={formErrors.medicalConditionDetails ? 'field-has-error' : ''}>
                  {labelText('Specify condition', form.medicalCondition === 'yes')}
                  <input
                    value={form.medicalConditionDetails}
                    onChange={(e) => setForm((f) => ({ ...f, medicalConditionDetails: e.target.value }))}
                  />
                  <FieldError message={formErrors.medicalConditionDetails} />
                </label>
                <label>
                  Hospitalized
                  <select value={form.hospitalized} onChange={(e) => setForm((f) => ({ ...f, hospitalized: e.target.value }))}>
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className={formErrors.hospitalizationDetails ? 'field-has-error' : ''}>
                  {labelText('Hospitalization details', form.hospitalized === 'yes')}
                  <input value={form.hospitalizationDetails} onChange={(e) => setForm((f) => ({ ...f, hospitalizationDetails: e.target.value }))} />
                  <FieldError message={formErrors.hospitalizationDetails} />
                </label>
                <label>
                  Allergy
                  <select value={form.allergy} onChange={(e) => setForm((f) => ({ ...f, allergy: e.target.value }))}>
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className={formErrors.allergyDetails ? 'field-has-error' : ''}>
                  {labelText('Allergy cause/s', form.allergy === 'yes')}
                  <input value={form.allergyDetails} onChange={(e) => setForm((f) => ({ ...f, allergyDetails: e.target.value }))} />
                  <FieldError message={formErrors.allergyDetails} />
                </label>
                <label>
                  Covid vaccination
                  <select value={form.covidVaccination} onChange={(e) => setForm((f) => ({ ...f, covidVaccination: e.target.value }))}>
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  1st dose
                  <input type="date" value={form.covidFirstDose} onChange={(e) => setForm((f) => ({ ...f, covidFirstDose: e.target.value }))} />
                  <FieldError message={formErrors.covidFirstDose} />
                </label>
                <label>
                  2nd dose
                  <input type="date" value={form.covidSecondDose} onChange={(e) => setForm((f) => ({ ...f, covidSecondDose: e.target.value }))} />
                </label>
                <label>
                  Booster 1
                  <input type="date" value={form.covidBooster1} onChange={(e) => setForm((f) => ({ ...f, covidBooster1: e.target.value }))} />
                </label>
                <fieldset className="medicine-field form-field-full">
                  <legend>Pre-existing health conditions</legend>
                  <div className="condition-options">
                    {healthConditionOptions.map((condition) => (
                      <label key={condition} className="medicine-option">
                        <input
                          type="checkbox"
                          checked={form.healthConditions.includes(condition)}
                          onChange={() => handleHealthConditionToggle(condition)}
                        />
                        <span>{condition}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  Any surgery
                  <select value={form.surgery} onChange={(e) => setForm((f) => ({ ...f, surgery: e.target.value }))}>
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className={formErrors.surgeryDetails ? 'field-has-error' : ''}>
                  {labelText('Surgery details', form.surgery === 'yes')}
                  <input value={form.surgeryDetails} onChange={(e) => setForm((f) => ({ ...f, surgeryDetails: e.target.value }))} />
                  <FieldError message={formErrors.surgeryDetails} />
                </label>
                <label>
                  Taking medication / maintenance
                  <select value={form.maintenanceMedication} onChange={(e) => setForm((f) => ({ ...f, maintenanceMedication: e.target.value }))}>
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label className={formErrors.maintenanceMedications ? 'field-has-error' : ''}>
                  {labelText('All medications', form.maintenanceMedication === 'yes')}
                  <input value={form.maintenanceMedications} onChange={(e) => setForm((f) => ({ ...f, maintenanceMedications: e.target.value }))} />
                  <FieldError message={formErrors.maintenanceMedications} />
                </label>
                <label className="form-field-full">
                  Signature over printed name
                  <input value={form.signatureName} onChange={(e) => setForm((f) => ({ ...f, signatureName: e.target.value }))} />
                </label>
                <div className="form-section-title form-field-full">Clinic visit</div>
                <label>
                  Date and time of visit
                  <input
                    type="datetime-local"
                    value={form.dateTime}
                    onChange={(e) => setForm((f) => ({ ...f, dateTime: e.target.value }))}
                  />
                </label>
                <label>
                  Temperature
                  <input value={form.temperature} onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))} placeholder="e.g. 37.2 C" />
                </label>
                <label>
                  Height
                  <input value={form.height} onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} placeholder="e.g. 160 cm" />
                </label>
                <label>
                  Weight
                  <input value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} placeholder="e.g. 55 kg" />
                </label>
                <label>
                  BP
                  <input value={form.bloodPressure} onChange={(e) => setForm((f) => ({ ...f, bloodPressure: e.target.value }))} placeholder="e.g. 120/80" />
                </label>
                <label>
                  RR
                  <input value={form.respiratoryRate} onChange={(e) => setForm((f) => ({ ...f, respiratoryRate: e.target.value }))} />
                </label>
                <label>
                  PR
                  <input value={form.pulseRate} onChange={(e) => setForm((f) => ({ ...f, pulseRate: e.target.value }))} />
                </label>
                <label>
                  O2 Sat (%)
                  <input value={form.oxygenSaturation} onChange={(e) => setForm((f) => ({ ...f, oxygenSaturation: e.target.value }))} />
                </label>
                <label className="clinic-visit-remarks-field">
                  Clinic visit remarks
                  <textarea value={form.clinicVisitRemarks} onChange={(e) => setForm((f) => ({ ...f, clinicVisitRemarks: e.target.value }))} />
                </label>
                <label className="form-field-full visit-major-complaint-field">
                  Signs and symptoms / major complaint
                  <textarea value={form.signsSymptoms} onChange={(e) => setForm((f) => ({ ...f, signsSymptoms: e.target.value }))} />
                </label>
                <label className="form-field-full">
                  Signs and symptoms remarks
                  <textarea value={form.visitRemarks} onChange={(e) => setForm((f) => ({ ...f, visitRemarks: e.target.value }))} />
                </label>
                <fieldset className="medicine-field form-field-full">
                  <legend>Medication / first aid provided</legend>
                  <p>Leave blank if no medicine was given. Out-of-stock items are disabled.</p>
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
                        const selectedMedicine = form.medicines.find((item) => getMedicineName(item) === medicine.name)
                        const selected = Boolean(selectedMedicine)
                        return (
                          <label
                            key={medicine.name}
                            className={`medicine-option medicine-option-with-quantity${medicine.outOfStock ? ' out-of-stock' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={medicine.outOfStock}
                              onChange={() => handleMedicineToggle(medicine, medicine.outOfStock)}
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
                                max={medicine.quantity}
                                value={getMedicineQuantity(selectedMedicine)}
                                onChange={(e) => handleMedicineQuantityChange(medicine, e.target.value)}
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
                  <textarea value={form.medicationRemarks} onChange={(e) => setForm((f) => ({ ...f, medicationRemarks: e.target.value }))} />
                </label>
                <label className="checkbox-line form-field-full">
                  <input
                    type="checkbox"
                    checked={form.sentHome}
                    onChange={(e) => updateRegisterSentHome(e.target.checked)}
                  />
                  Sent home
                </label>
                {form.sentHome && (
                  <>
                    <label className={formErrors.sentHomeDate ? 'field-has-error' : ''}>
                      {labelText('Sent home date', true)}
                      <input type="date" value={form.sentHomeDate} onChange={(e) => updateRegisterField('sentHomeDate', e.target.value)} required />
                      <FieldError message={formErrors.sentHomeDate} />
                    </label>
                    <label className={formErrors.sentHomeTime ? 'field-has-error' : ''}>
                      {labelText('Sent home time', true)}
                      <input type="time" value={form.sentHomeTime} onChange={(e) => updateRegisterField('sentHomeTime', e.target.value)} required />
                      <FieldError message={formErrors.sentHomeTime} />
                    </label>
                    <label>
                      Email notification address
                      <input
                        type="email"
                        value={form.email || ''}
                        onChange={(e) => updateRegisterField('email', e.target.value)}
                        placeholder="parent-or-guardian@example.com"
                      />
                    </label>
                  </>
                )}
                <label className="form-field-full">
                  Attending physician
                  <input value={form.attendingPhysician} onChange={(e) => setForm((f) => ({ ...f, attendingPhysician: e.target.value }))} />
                </label>
                <div className="detail-actions form-field-full">
                  <button type="submit" className="primary-action" disabled={isRegisterSaving}>
                    <Icon name="plus" /> {isRegisterSaving ? 'Saving...' : 'Save visit'}
                  </button>
                  <button type="button" className="text-button" onClick={() => setRegistrationStep('search')}>
                    Back to search
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showImportModal && (
          <ImportModal
          title="Import Records"
          description="Import patient records from CSV or Excel. Required columns: name and role. Patient IDs are optional."
          onClose={closeImportModal}
          onPreview={clinicApi.previewPatientRecordImport}
          onConfirm={clinicApi.confirmPatientRecordImport}
          onImported={handleImportComplete}
        />
      )}

      {/* Record detail modal */}
      {showDetail && editStudent && (
        <div className="modal-backdrop" onClick={() => {
          setShowDetail(null)
          setEditStudent(null)
        }}>
          <div className="visit-modal student-detail-modal student-form-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => {
              setShowDetail(null)
              setEditStudent(null)
            }}>
              <Icon name="close" />
            </button>
            <p className="section-kicker">PROFILE RECORD</p>

            <div className="detail-header">
              <span className={`visit-avatar ${getAvatarTone(editStudent)}`} style={{ width: 48, height: 48, fontSize: '.85rem' }}>
                {getInitials(editStudent.name || showDetail.name)}
              </span>
              <div>
                <h2>{editStudent.name || 'Record details'}</h2>
                <p className="detail-id">{getRecordId(editStudent) || getRecordId(showDetail)}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateStudent} className="modal-form-grid" noValidate>
              <label className={editErrors.name ? 'field-has-error' : ''}>
                {labelText('Last Name', true)}
                <input
                  value={editStudent.lastName || ''}
                  onChange={(e) => updateEditNamePart('lastName', e.target.value)}
                  required
                />
              </label>
              <label className={editErrors.name ? 'field-has-error' : ''}>
                {labelText('First Name', true)}
                <input
                  value={editStudent.firstName || ''}
                  onChange={(e) => updateEditNamePart('firstName', e.target.value)}
                  required
                />
              </label>
              <label className={editErrors.name ? 'field-has-error' : ''}>
                Middle Name
                <input
                  value={editStudent.middleName || ''}
                  onChange={(e) => updateEditNamePart('middleName', e.target.value)}
                />
                <FieldError message={editErrors.name} />
              </label>
              <label className={editErrors.position ? 'field-has-error' : ''}>
                {labelText('Position', true)}
                <select
                  value={editStudent.position}
                  onChange={(e) => {
                    const position = e.target.value
                    setEditStudent((student) => ({
                      ...student,
                      position,
                      department: isDepartmentlessStaffPosition(position) ? '' : student.department || '',
                      employeeId: isStaffPosition(position) ? student.employeeId : '',
                      studentId: isStudentPosition(position) ? student.studentId : '',
                      course: isStudentPosition(position) ? student.course : '',
                      yearLevel: isStudentPosition(position) ? student.yearLevel : '',
                      section: isStudentPosition(position) ? student.section : '',
                    }))
                    setEditErrors((current) => ({ ...current, position: '', department: '', employeeId: '', studentId: '', course: '' }))
                  }}
                  required
                >
                  {positionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <FieldError message={editErrors.position} />
              </label>
              {isStudentPosition(editStudent.position) && (
                <label className={editErrors.department ? 'field-has-error' : ''}>
                  {labelText('Department', true)}
                  <select
                    value={editStudent.department}
                    onChange={(e) => {
                      const department = e.target.value
                      setEditStudent((student) => ({
                        ...student,
                        department,
                        course: departmentCourseOptions[department]?.some((option) => option.value === student.course)
                          ? student.course
                          : '',
                        yearLevel: departmentCourseOptions[department]?.some((option) => option.value === student.course)
                          ? student.yearLevel
                          : '',
                      }))
                      setEditErrors((current) => ({ ...current, department: '' }))
                    }}
                    required
                  >
                    {departmentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={editErrors.department} />
                </label>
              )}
              {!isStudentPosition(editStudent.position) && !isDepartmentlessStaffPosition(editStudent.position) && (
                <label className={editErrors.department ? 'field-has-error' : ''}>
                  {labelText('Department', true)}
                  <select
                    value={editStudent.department}
                    onChange={(e) => updateEditField('department', e.target.value)}
                    required
                  >
                    {staffDepartmentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={editErrors.department} />
                </label>
              )}
              {isStudentPosition(editStudent.position) && (
                <>
                  <label className={editErrors.course ? 'field-has-error' : ''}>
                    {labelText('Course', true)}
                    <select
                      value={editStudent.course}
                      onChange={(e) => {
                        const course = e.target.value
                        setEditStudent((student) => ({
                          ...student,
                          course,
                          yearLevel:
                            course === 'ACT' &&
                            !twoYearCourseOptions.some((option) => option.value === student.yearLevel)
                              ? ''
                            : student.yearLevel,
                        }))
                        setEditErrors((current) => ({ ...current, course: '' }))
                      }}
                      required
                    >
                      {editCourseOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <FieldError message={editErrors.course} />
                  </label>
                  <label className={editErrors.studentId ? 'field-has-error' : ''}>
                    {labelText('Student ID', true)}
                    <input
                      value={editStudent.studentId}
                      onChange={(e) => updateEditField('studentId', e.target.value)}
                      required
                    />
                    <FieldError message={editErrors.studentId} />
                  </label>
                  <label className={editErrors.yearLevel ? 'field-has-error' : ''}>
                    {labelText('Year level', true)}
                    <select
                      value={editStudent.yearLevel}
                      onChange={(e) => updateEditField('yearLevel', e.target.value)}
                      required
                    >
                      {editYearLevelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <FieldError message={editErrors.yearLevel} />
                  </label>
                  <label className={editErrors.section ? 'field-has-error' : ''}>
                    {labelText('Block / Section', true)}
                    <input
                      value={editStudent.section}
                      onChange={(e) => updateEditField('section', e.target.value)}
                      required
                    />
                    <FieldError message={editErrors.section} />
                  </label>
                </>
              )}
              {!isStudentPosition(editStudent.position) && (
                <label className={editErrors.employeeId ? 'field-has-error' : ''}>
                  {labelText('Employee ID', true)}
                  <input
                    value={editStudent.employeeId}
                    onChange={(e) => updateEditField('employeeId', e.target.value)}
                    required
                  />
                  <FieldError message={editErrors.employeeId} />
                </label>
              )}
              <label className={editErrors.contact ? 'field-has-error' : ''}>
                {labelText('Contact number', true)}
                <input
                  value={editStudent.contact}
                  onChange={(e) => updateEditField('contact', e.target.value)}
                  type="tel"
                  inputMode="numeric"
                  maxLength="11"
                  pattern="[0-9]{11}"
                  required
                />
                <FieldError message={editErrors.contact} />
              </label>
              <label>
                Email notification address
                <input
                  type="email"
                  value={editStudent.email || ''}
                  onChange={(e) => updateEditField('email', e.target.value)}
                  placeholder="parent-or-guardian@example.com"
                />
              </label>
              <label className={`form-field-full${editErrors.address ? ' field-has-error' : ''}`}>
                {labelText('Address', true)}
                <input
                  value={editStudent.address}
                  onChange={(e) => updateEditField('address', e.target.value)}
                  required
                />
                <FieldError message={editErrors.address} />
              </label>
              <label className={editErrors.birthdate ? 'field-has-error' : ''}>
                {labelText('Date of birth', true)}
                <input
                  type="date"
                  value={editStudent.birthdate}
                  onChange={(e) => updateEditField('birthdate', e.target.value)}
                  required
                />
                <FieldError message={editErrors.birthdate} />
              </label>
              <label className={editErrors.emergencyContactName ? 'field-has-error' : ''}>
                {labelText('Emergency contact person', true)}
                <input
                  value={editStudent.emergencyContactName}
                  onChange={(e) => updateEditField('emergencyContactName', e.target.value)}
                  required
                />
                <FieldError message={editErrors.emergencyContactName} />
              </label>
              <label className={editErrors.emergencyContactPhone ? 'field-has-error' : ''}>
                {labelText('Emergency contact number', true)}
                <input
                  value={editStudent.emergencyContactPhone}
                  onChange={(e) => updateEditField('emergencyContactPhone', e.target.value)}
                  type="tel"
                  inputMode="numeric"
                  maxLength="11"
                  pattern="[0-9]{11}"
                  required
                />
                <FieldError message={editErrors.emergencyContactPhone} />
              </label>
              <div className="detail-item form-field-full">
                <span className="detail-label">Clinic visits</span>
                <span className="detail-value">
                  {getVisitCount(showDetail)} visit
                  {getVisitCount(showDetail) !== 1 ? 's' : ''} recorded
                </span>
              </div>

              <div className="detail-actions form-field-full">
                <div className="detail-primary-actions">
                  <button type="submit" className="primary-action" disabled={isPatientSaving}>
                    <Icon name="clipboard" /> {isPatientSaving ? 'Saving patient...' : 'Update record'}
                  </button>
                  <button
                    type="button"
                    className="primary-action danger-action"
                    onClick={() => setDeleteStudent(showDetail)}
                  >
                    <Icon name="close" /> Delete record
                  </button>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setShowDetail(null)
                    setEditStudent(null)
                  }}
                  style={{ fontSize: '.82rem', padding: '8px 0' }}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteStudent && (
        <ConfirmDialog
          title="Delete Patient?"
          description={`Are you sure you want to delete ${deleteStudent.name || 'this patient'}'s record?`}
          onCancel={() => setDeleteStudent(null)}
          onConfirm={handleDeleteStudent}
          loading={isPatientDeleting}
        />
      )}
    </div>
  )
}
