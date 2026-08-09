import { useState, useMemo, useCallback, useEffect } from 'react'
import { getInitials, getStatusTone } from '../src/utils/visitHelpers'
import { defaultMedicineInventory } from '../src/data/constants'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'

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
  dateTime: '',
  concern: '',
  findings: '',
  medicines: [],
}

// Helper: load current medicine inventory from localStorage
function loadMedicineInventory() {
  try {
    const saved = localStorage.getItem('medicines')
    if (saved) return JSON.parse(saved)
    localStorage.setItem('medicines', JSON.stringify(defaultMedicineInventory))
    return defaultMedicineInventory
  } catch {
    return defaultMedicineInventory
  }
}

// Helper: decrement given medicines from the inventory stock
function decrementMedicineStock(medicinesGiven) {
  if (!medicinesGiven || medicinesGiven.length === 0) return
  const inventory = loadMedicineInventory()
  const updated = inventory.map((item) => {
    if (medicinesGiven.includes(item.name)) {
      return { ...item, quantity: Math.max(0, (Number(item.quantity) || 0) - 1) }
    }
    return item
  })
  localStorage.setItem('medicines', JSON.stringify(updated))
}

const positionOptions = [
  { value: '', label: 'Select position' },
  { value: 'Student', label: 'Student' },
  { value: 'Instructor', label: 'Instructor' },
  { value: 'Guard', label: 'Guard' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Admin', label: 'Admin' },
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
    { value: 'BSPA', label: 'BSPA' },
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
  { value: 'Security', label: 'Security' },
  { value: 'Facilities and Maintenance', label: 'Facilities and Maintenance' },
  { value: 'Administration', label: 'Administration' },
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
  return ['Instructor', 'Guard', 'Maintenance', 'Admin'].includes(position)
}

function getRecordId(record) {
  return record.studentId || record.employeeId || ''
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
  }
}

function buildStudentsFromVisits(visits, existingStudents = []) {
  const studentsById = new Map()

  existingStudents.forEach((student) => {
    const id = getRecordId(student)
    if (id) studentsById.set(id, student)
  })

  visits.forEach((visit) => {
    const id = getRecordId(visit)
    if (!id || studentsById.has(id)) return

    studentsById.set(id, {
      studentId: visit.studentId,
      employeeId: visit.employeeId || '',
      name: visit.name || 'Unnamed student',
      position: visit.position || 'Student',
      department: visit.department || '',
      course: visit.course || '',
      yearLevel: visit.yearLevel || '',
      section: visit.section || '',
      contact: '',
      address: '',
      registeredAt: visit.visitDateTime || new Date().toISOString(),
    })
  })

  return Array.from(studentsById.values())
}

export default function ManageStudentsPage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Students')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [registrationStep, setRegistrationStep] = useState('search')
  const [recordQuery, setRecordQuery] = useState('')
  const [showDetail, setShowDetail] = useState(null)
  const [editStudent, setEditStudent] = useState(null)
  const [form, setForm] = useState(emptyStudentForm)
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

  // Medicine inventory from localStorage
  const [medicineInventory, setMedicineInventory] = useState(() => loadMedicineInventory())

  // Derived medicine option list (with stock labels)
  const medicineOptions = useMemo(
    () =>
      medicineInventory.map((item) => {
        const q = Number(item.quantity) || 0
        return {
          name: item.name,
          outOfStock: q <= 0,
          stockLabel: q <= 0 ? 'Out of stock' : `${q} left`,
        }
      }),
    [medicineInventory]
  )

  // Students from localStorage
  const [students, setStudents] = useState(() => {
    try {
      const saved = localStorage.getItem('students')
      const visits = JSON.parse(localStorage.getItem('visits') || '[]')
      const parsed = saved ? JSON.parse(saved) : []
      const restored = buildStudentsFromVisits(visits, parsed)

      if (restored.length !== parsed.length) {
        localStorage.setItem('students', JSON.stringify(restored))
      }

      return restored
    } catch {
      return []
    }
  })

  // Save students to localStorage
  useEffect(() => {
    localStorage.setItem('students', JSON.stringify(students))
  }, [students])

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
      const visits = JSON.parse(localStorage.getItem('visits') || '[]')
      const id = getRecordId(s)
      return visits.some((v) => getRecordId(v) === id)
    }).length
    return { total, courses, withVisits }
  }, [students])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Students') onNavigate(item)
    },
    [onNavigate]
  )

  const setNoticeSafe = useCallback((msg) => setNotice(msg), [])

  const openRegisterModal = useCallback(() => {
    setForm(emptyStudentForm)
    setRecordQuery(query)
    setRegistrationStep('search')
    setShowModal(true)
  }, [query])

  const closeRegisterModal = useCallback(() => {
    setShowModal(false)
    setRegistrationStep('search')
    setRecordQuery('')
    setForm(emptyStudentForm)
  }, [])

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
    })
    setRegistrationStep('form')
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
    (e) => {
      e.preventDefault()
      const fallbackId = `STU-${Date.now().toString(36).toUpperCase()}`
      const submittedStudent = normalizeStudentForm(form, fallbackId)

      if (!submittedStudent.name) {
        setNotice('Please enter a full name.')
        return
      }

      const id = getRecordId(submittedStudent)
      const now = new Date()
      const existingStudent = students.find((s) => getRecordId(s) === id)
      const nextStudent = {
        ...(existingStudent || {}),
        ...submittedStudent,
        registeredAt: existingStudent?.registeredAt || now.toISOString(),
      }

      setStudents((prev) =>
        existingStudent
          ? prev.map((student) => (getRecordId(student) === id ? nextStudent : student))
          : [nextStudent, ...prev]
      )

      // Reduce inventory stock for given medicines
      if (form.medicines && form.medicines.length > 0) {
        decrementMedicineStock(form.medicines)
        setMedicineInventory(loadMedicineInventory())
      }

      try {
        const savedVisits = JSON.parse(localStorage.getItem('visits') || '[]')
        const newVisit = {
          initials: getInitials(nextStudent.name),
          name: nextStudent.name,
          position: nextStudent.position,
          department: nextStudent.department,
          studentId: nextStudent.studentId,
          employeeId: nextStudent.employeeId,
          course: nextStudent.course,
          yearLevel: nextStudent.yearLevel,
          section: nextStudent.section,
          concern: form.concern || 'General check-up',
          findings: form.findings.trim(),
          medicines: form.medicines,
          visitDateTime: form.dateTime || now.toISOString(),
          timestamp: now.getTime(),
          tone: 'red',
          dischargedAt: null,
        }
        localStorage.setItem('visits', JSON.stringify([newVisit, ...savedVisits]))
      } catch {
        setNotice('Record saved, but the visit record could not be created.')
        return
      }

      closeRegisterModal()
      setNotice(
        existingStudent
          ? `${nextStudent.name}'s details and visit have been updated.`
          : `${nextStudent.name} has been registered and their visit has been recorded.`
      )
    },
    [closeRegisterModal, form, students]
  )

  const handleUpdateStudent = useCallback(
    (e) => {
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
        course: isStudent ? editStudent.course : '',
        yearLevel: isStudent ? editStudent.yearLevel : '',
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

      setStudents((prev) =>
        prev.map((student) =>
          getRecordId(student) === originalRecordId ? nextStudent : student
        )
      )

      try {
        const visits = JSON.parse(localStorage.getItem('visits') || '[]')
        const updatedVisits = visits.map((visit) =>
          getRecordId(visit) === originalRecordId
            ? {
                ...visit,
                position: nextStudent.position,
                department: nextStudent.department,
                studentId: nextStudent.studentId,
                employeeId: nextStudent.employeeId,
                name: nextStudent.name,
                course: nextStudent.course,
                yearLevel: nextStudent.yearLevel,
                section: nextStudent.section,
                initials: getInitials(nextStudent.name),
              }
            : visit
        )
        localStorage.setItem('visits', JSON.stringify(updatedVisits))
      } catch {
        setNotice('Record updated, but visit records could not be synced.')
        setShowDetail(nextStudent)
        setEditStudent(nextStudent)
        return
      }

      setShowDetail(nextStudent)
      setEditStudent(nextStudent)
      setNotice(`${nextStudent.name}'s details have been updated.`)
    },
    [editStudent, showDetail, students]
  )

  const handleDeleteStudent = useCallback(() => {
    if (!showDetail) return

    const studentName = showDetail.name || 'this student'
    const confirmed = window.confirm(
      `Are you sure you want to delete ${studentName}? This will also remove their clinic visit records.`
    )

    if (!confirmed) return

    const recordId = getRecordId(showDetail)
    setStudents((prev) => prev.filter((student) => getRecordId(student) !== recordId))

    try {
      const visits = JSON.parse(localStorage.getItem('visits') || '[]')
      const updatedVisits = visits.filter((visit) => getRecordId(visit) !== recordId)
      localStorage.setItem('visits', JSON.stringify(updatedVisits))
    } catch {
      setNotice('Record deleted, but visit records could not be cleaned up.')
    }

    setShowDetail(null)
    setEditStudent(null)
    setNotice(`${studentName} has been deleted.`)
  }, [showDetail])

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
  const getVisitCount = useCallback((studentId) => {
    try {
      const visits = JSON.parse(localStorage.getItem('visits') || '[]')
      return visits.filter((v) => getRecordId(v) === studentId).length
    } catch {
      return 0
    }
  }, [])

  // Red means currently active in the clinic; green means timed out or inactive.
  const getAvatarTone = useCallback((record) => {
    try {
      const recordId = getRecordId(record)
      const visits = JSON.parse(localStorage.getItem('visits') || '[]')
      const matchingVisits = visits.filter((visit) => {
        if (recordId) return getRecordId(visit) === recordId
        return visit.name === record.name
      })
      const activeVisit = matchingVisits.find((visit) => !visit.dischargedAt)
      if (activeVisit) return getStatusTone(activeVisit)
      return 'green'
    } catch {
      return 'green'
    }
  }, [])

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
          <button className="primary-action" onClick={openRegisterModal}>
            <Icon name="plus" /> Register visit
          </button>
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
                      {getVisitCount(getRecordId(student))} visit
                      {getVisitCount(getRecordId(student)) !== 1 ? 's' : ''}
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
                    {(isStudentPosition(form.position) ? departmentOptions : staffDepartmentOptions).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                {isStudentPosition(form.position) ? (
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
                ) : (
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
                <label className="form-field-full">
                  Findings
                  <input
                    value={form.findings}
                    onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))}
                    placeholder="e.g. Temperature, BP, observations"
                  />
                </label>
                <fieldset className="medicine-field form-field-full">
                  <legend>Medicine given</legend>
                  <p>Leave blank if no medicine was given. Out-of-stock items are disabled.</p>
                  <div className="medicine-options">
                    {medicineOptions.length === 0 ? (
                      <span className="medicine-empty">No medicines in inventory yet.</span>
                    ) : (
                      medicineOptions.map((medicine) => (
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
                            <em className="stock-hint">{medicine.stockLabel}</em>
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
                  {(isStudentPosition(editStudent.position) ? departmentOptions : staffDepartmentOptions).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              {isStudentPosition(editStudent.position) ? (
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
              ) : (
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
                  {getVisitCount(getRecordId(showDetail))} visit
                  {getVisitCount(getRecordId(showDetail)) !== 1 ? 's' : ''} recorded
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
