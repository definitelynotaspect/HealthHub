import { useState, useMemo, useCallback, useEffect } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { getInitials, getStatusTone } from '../src/utils/visitHelpers'
import { defaultMedicineInventory } from '../src/data/constants'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import ImportModal from '../src/components/ImportModal'

const emptyStudentForm = {
  studentId: '',
  employeeId: '',
  name: '',
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

function getDefaultMedicineCategory(name) {
  return defaultMedicineInventory.find(
    (medicine) => medicine.name.toLowerCase() === String(name).toLowerCase()
  )?.category || 'General medicine'
}

function normalizeMedicineItem(item) {
  return {
    ...item,
    category: item.category || getDefaultMedicineCategory(item.name),
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

  return {
    studentId: isStudent ? form.studentId.trim() || fallbackId : '',
    employeeId: isStaffPosition(position) ? form.employeeId.trim() || fallbackId : '',
    name: form.name.trim(),
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

export default function ManageStudentsPage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Patients')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [registrationStep, setRegistrationStep] = useState('search')
  const [recordQuery, setRecordQuery] = useState('')
  const [showDetail, setShowDetail] = useState(null)
  const [editStudent, setEditStudent] = useState(null)
  const [form, setForm] = useState(emptyStudentForm)
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

  const [medicineInventory, setMedicineInventory] = useState([])
  const [students, setStudents] = useState([])
  const [visits, setVisits] = useState([])

  // Derived medicine option list (with stock labels)
  const medicineOptions = useMemo(
    () =>
      medicineInventory.map((item) => {
        const q = Number(item.quantity) || 0
        return {
          name: item.name,
          category: item.category || getDefaultMedicineCategory(item.name),
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

    setStudents(recordsResponse.data)
    setVisits(visitsResponse.data)
    setMedicineInventory(medicinesResponse.data.map(normalizeMedicineItem))
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadClinicData() {
      try {
        const [recordsResponse, visitsResponse, medicinesResponse] = await Promise.all([
          clinicApi.getPatientRecords(),
          clinicApi.getVisits(),
          clinicApi.getMedicines(),
        ])

        if (!ignore) {
          setStudents(recordsResponse.data)
          setVisits(visitsResponse.data)
          setMedicineInventory(medicinesResponse.data.map(normalizeMedicineItem))
        }
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load clinic records.')
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
    setShowModal(true)
  }, [query])

  const closeRegisterModal = useCallback(() => {
    setShowModal(false)
    setRegistrationStep('search')
    setRecordQuery('')
    setSelectedMedicineCategory('')
    setForm(emptyStudentForm)
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
    }))
    setRegistrationStep('form')
  }, [recordQuery])

  const handleSelectExistingRecord = useCallback((student) => {
    setForm({
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
    })
    setRegistrationStep('form')
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
      const selected = current.medicines.includes(medicine)
      return {
        ...current,
        medicines: selected
          ? current.medicines.filter((item) => item !== medicine)
          : [...current.medicines, medicine],
      }
    })
  }, [])

  // Register a student and record their clinic visit
  const handleRegister = useCallback(
    async (e) => {
      e.preventDefault()
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

      if (!submittedStudent.name) {
        setNotice('Please enter a full name.')
        return
      }

      const now = new Date()

      try {
        await clinicApi.createVisit({
          patientRecordId: existingStudent?.id,
          ...submittedStudent,
          concern: form.concern || 'General check-up',
          temperature: form.temperature,
          height: form.height,
          weight: form.weight,
          bloodPressure: form.bloodPressure,
          respiratoryRate: form.respiratoryRate,
          pulseRate: form.pulseRate,
          oxygenSaturation: form.oxygenSaturation,
          signsSymptoms: form.signsSymptoms,
          visitRemarks: form.visitRemarks,
          medicationFirstAid: form.medicationFirstAid,
          medicationRemarks: form.medicationRemarks,
          sentHome: form.sentHome,
          sentHomeDate: form.sentHomeDate,
          sentHomeTime: form.sentHomeTime,
          attendingPhysician: form.attendingPhysician,
          medicines: form.medicines,
          visitDateTime: form.dateTime || '',
          timestamp: now.getTime(),
        })
        await refreshClinicData()
        closeRegisterModal()
        setNotice(
          existingStudent
            ? `${submittedStudent.name}'s details and visit have been updated.`
            : `${submittedStudent.name} has been registered and their visit has been recorded.`
        )
      } catch (error) {
        setNotice(error.message || 'Unable to save this visit.')
      }
    },
    [closeRegisterModal, form, refreshClinicData, students]
  )

  const handleUpdateStudent = useCallback(
    async (e) => {
      e.preventDefault()
      if (!showDetail || !editStudent) return

      const originalId = showDetail.studentId
      const originalRecordId = getRecordId(showDetail)
      const position = editStudent.position || 'Student'
      const isStudent = isStudentPosition(position)
      const nextStudent = {
        ...showDetail,
        studentId: isStudent ? editStudent.studentId.trim() || originalId : '',
        employeeId: isStaffPosition(position) ? editStudent.employeeId.trim() || originalRecordId : '',
        name: editStudent.name.trim(),
        position,
        department: editStudent.department || '',
        course: isStudent ? editStudent.course || '' : '',
        yearLevel: isStudent ? editStudent.yearLevel || '' : '',
        section: isStudent ? editStudent.section.trim() : '',
        contact: editStudent.contact.trim(),
        address: editStudent.address.trim(),
      }

      if (!nextStudent.name) {
        setNotice('Please enter a full name.')
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
        const { data } = await clinicApi.updatePatientRecord(showDetail.id, nextStudent)
        await refreshClinicData()
        setShowDetail(data)
        setEditStudent(data)
        setNotice(`${data.name}'s details have been updated.`)
      } catch (error) {
        setNotice(error.message || 'Unable to update this record.')
      }
    },
    [editStudent, refreshClinicData, showDetail, students]
  )

  const handleDeleteStudent = useCallback(async () => {
    if (!showDetail) return

    const studentName = showDetail.name || 'this student'
    const confirmed = window.confirm(
      `Are you sure you want to delete ${studentName}? This will also remove their clinic visit records.`
    )

    if (!confirmed) return

    try {
      await clinicApi.deletePatientRecord(showDetail.id)
      await refreshClinicData()
      setShowDetail(null)
      setEditStudent(null)
      setNotice(`${studentName} has been deleted.`)
    } catch (error) {
      setNotice(error.message || 'Unable to delete this record.')
    }
  }, [refreshClinicData, showDetail])

  // View student details from a visit click
  const handleViewStudent = useCallback((student) => {
    const editableStudent = {
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
    }
    setShowDetail(editableStudent)
    setEditStudent(editableStudent)
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
      <Sidebar activeNav={activeNav} onNavSelect={handleNavSelect} onSignOut={onSignOut} />

      <main className="main-content">
        <Topbar
          query={query}
          onQueryChange={setQuery}
          onNotification={setNoticeSafe}
          onProfile={() => handleNavSelect('Nurse Profile')}
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

            {students.length === 0 ? (
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
              <form onSubmit={handleRegister} className="modal-form-grid">
                <label>
                  Full name *
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Juan Dela Cruz"
                    required
                  />
                </label>
                <label>
                  Position
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
                    }}
                  >
                    {positionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                {isStudentPosition(form.position) && (
                  <label>
                    Department
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
                      }}
                    >
                      {departmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!isStudentPosition(form.position) && !isDepartmentlessStaffPosition(form.position) && (
                  <label>
                    Department
                    <select
                      value={form.department}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    >
                      {staffDepartmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {isStudentPosition(form.position) && (
                  <>
                    <label>
                      Course
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
                        }}
                      >
                        {registerCourseOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Student ID
                      <input
                        value={form.studentId}
                        onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                        placeholder="e.g. ICF-2024-001"
                      />
                    </label>
                    <label>
                      Year level
                      <select
                        value={form.yearLevel}
                        onChange={(e) => setForm((f) => ({ ...f, yearLevel: e.target.value }))}
                      >
                        {registerYearLevelOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Block / Section
                      <input
                        value={form.section}
                        onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                        placeholder="e.g. A"
                      />
                    </label>
                  </>
                )}
                {!isStudentPosition(form.position) && (
                  <label>
                    Employee ID
                    <input
                      value={form.employeeId}
                      onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                      placeholder="e.g. EMP-2024-001"
                    />
                  </label>
                )}
                <label>
                  Contact number
                  <input
                    value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                    placeholder="e.g. 09123456789"
                    type="tel"
                  />
                </label>
                <label className="form-field-full">
                  Address
                  <input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="e.g. Brgy. San Juan, City"
                  />
                </label>
                <div className="form-section-title form-field-full">Personal data</div>
                <label>
                  Date of birth
                  <input
                    type="date"
                    value={form.birthdate}
                    onChange={(e) => setForm((f) => ({ ...f, birthdate: e.target.value }))}
                  />
                </label>
                <label>
                  Place of birth
                  <input
                    value={form.placeOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, placeOfBirth: e.target.value }))}
                  />
                </label>
                <label>
                  Gender
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </label>
                <label>
                  Blood type
                  <input
                    value={form.bloodType}
                    onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))}
                    placeholder="e.g. O+"
                  />
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
                <label>
                  Emergency contact person
                  <input
                    value={form.emergencyContactName}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                  />
                </label>
                <label>
                  Tel / CP no.
                  <input
                    value={form.emergencyContactPhone}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))}
                  />
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
                    onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone2: e.target.value }))}
                  />
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
                <label>
                  Missed immunization
                  <input
                    value={form.missedImmunization}
                    onChange={(e) => setForm((f) => ({ ...f, missedImmunization: e.target.value }))}
                  />
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
                <label>
                  Specify condition
                  <input
                    value={form.medicalConditionDetails}
                    onChange={(e) => setForm((f) => ({ ...f, medicalConditionDetails: e.target.value }))}
                  />
                </label>
                <label>
                  Hospitalized
                  <select value={form.hospitalized} onChange={(e) => setForm((f) => ({ ...f, hospitalized: e.target.value }))}>
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  Hospitalization details
                  <input value={form.hospitalizationDetails} onChange={(e) => setForm((f) => ({ ...f, hospitalizationDetails: e.target.value }))} />
                </label>
                <label>
                  Allergy
                  <select value={form.allergy} onChange={(e) => setForm((f) => ({ ...f, allergy: e.target.value }))}>
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  Allergy cause/s
                  <input value={form.allergyDetails} onChange={(e) => setForm((f) => ({ ...f, allergyDetails: e.target.value }))} />
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
                <label>
                  Surgery details
                  <input value={form.surgeryDetails} onChange={(e) => setForm((f) => ({ ...f, surgeryDetails: e.target.value }))} />
                </label>
                <label>
                  Taking medication / maintenance
                  <select value={form.maintenanceMedication} onChange={(e) => setForm((f) => ({ ...f, maintenanceMedication: e.target.value }))}>
                    <option value="">Not answered</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  All medications
                  <input value={form.maintenanceMedications} onChange={(e) => setForm((f) => ({ ...f, maintenanceMedications: e.target.value }))} />
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
                  Concern / reason for visit
                  <input
                    value={form.concern}
                    onChange={(e) => setForm((f) => ({ ...f, concern: e.target.value }))}
                    placeholder="e.g. Headache, fever, stomach pain"
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
                <label className="form-field-full">
                  Signs and symptoms / major complaint
                  <textarea value={form.signsSymptoms} onChange={(e) => setForm((f) => ({ ...f, signsSymptoms: e.target.value }))} />
                </label>
                <label className="form-field-full">
                  Visit remarks
                  <textarea value={form.visitRemarks} onChange={(e) => setForm((f) => ({ ...f, visitRemarks: e.target.value }))} />
                </label>
                <label className="form-field-full">
                  Medication / first aid provided
                  <textarea value={form.medicationFirstAid} onChange={(e) => setForm((f) => ({ ...f, medicationFirstAid: e.target.value }))} />
                </label>
                <label className="form-field-full">
                  Medication remarks
                  <textarea value={form.medicationRemarks} onChange={(e) => setForm((f) => ({ ...f, medicationRemarks: e.target.value }))} />
                </label>
                <label className="checkbox-line form-field-full">
                  <input
                    type="checkbox"
                    checked={form.sentHome}
                    onChange={(e) => setForm((f) => ({ ...f, sentHome: e.target.checked }))}
                  />
                  Sent home
                </label>
                <label>
                  Sent home date
                  <input type="date" value={form.sentHomeDate} onChange={(e) => setForm((f) => ({ ...f, sentHomeDate: e.target.value }))} />
                </label>
                <label>
                  Sent home time
                  <input type="time" value={form.sentHomeTime} onChange={(e) => setForm((f) => ({ ...f, sentHomeTime: e.target.value }))} />
                </label>
                <label className="form-field-full">
                  Attending physician
                  <input value={form.attendingPhysician} onChange={(e) => setForm((f) => ({ ...f, attendingPhysician: e.target.value }))} />
                </label>
                <fieldset className="medicine-field form-field-full">
                  <legend>Medicine given</legend>
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
                      visibleMedicineOptions.map((medicine) => (
                        <label
                          key={medicine.name}
                          className={`medicine-option${medicine.outOfStock ? ' out-of-stock' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={form.medicines.includes(medicine.name)}
                            disabled={medicine.outOfStock}
                            onChange={() => handleMedicineToggle(medicine.name, medicine.outOfStock)}
                          />
                          <span>
                            {medicine.name}
                            <em className="stock-hint">{medicine.category} - {medicine.stockLabel}</em>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </fieldset>
                <div className="detail-actions form-field-full">
                  <button type="submit" className="primary-action">
                    <Icon name="plus" /> Save visit
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
          description="Import patient records from CSV or Excel. Required columns: student_id, name, role, and course_department."
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

            <form onSubmit={handleUpdateStudent} className="modal-form-grid">
              <label>
                Full name *
                <input
                  value={editStudent.name}
                  onChange={(e) => setEditStudent((student) => ({ ...student, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Position
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
                  }}
                >
                  {positionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              {isStudentPosition(editStudent.position) && (
                <label>
                  Department
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
                    }}
                  >
                    {departmentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!isStudentPosition(editStudent.position) && !isDepartmentlessStaffPosition(editStudent.position) && (
                <label>
                  Department
                  <select
                    value={editStudent.department}
                    onChange={(e) => setEditStudent((student) => ({ ...student, department: e.target.value }))}
                  >
                    {staffDepartmentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {isStudentPosition(editStudent.position) && (
                <>
                  <label>
                    Course
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
                      }}
                    >
                      {editCourseOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Student ID
                    <input
                      value={editStudent.studentId}
                      onChange={(e) => setEditStudent((student) => ({ ...student, studentId: e.target.value }))}
                    />
                  </label>
                  <label>
                    Year level
                    <select
                      value={editStudent.yearLevel}
                      onChange={(e) => setEditStudent((student) => ({ ...student, yearLevel: e.target.value }))}
                    >
                      {editYearLevelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Block / Section
                    <input
                      value={editStudent.section}
                      onChange={(e) => setEditStudent((student) => ({ ...student, section: e.target.value }))}
                    />
                  </label>
                </>
              )}
              {!isStudentPosition(editStudent.position) && (
                <label>
                  Employee ID
                  <input
                    value={editStudent.employeeId}
                    onChange={(e) => setEditStudent((student) => ({ ...student, employeeId: e.target.value }))}
                  />
                </label>
              )}
              <label>
                Contact number
                <input
                  value={editStudent.contact}
                  onChange={(e) => setEditStudent((student) => ({ ...student, contact: e.target.value }))}
                  type="tel"
                />
              </label>
              <label className="form-field-full">
                Address
                <input
                  value={editStudent.address}
                  onChange={(e) => setEditStudent((student) => ({ ...student, address: e.target.value }))}
                />
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
                  <button type="submit" className="primary-action">
                    <Icon name="clipboard" /> Update record
                  </button>
                  <button
                    type="button"
                    className="primary-action danger-action"
                    onClick={handleDeleteStudent}
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
    </div>
  )
}
