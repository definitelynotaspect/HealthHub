import { Fragment, useState, useMemo, useCallback, useEffect } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import { formatVisitDate, getInitials, getStatusTone, toLocalDateKey, toLocalDateTimeInputValue } from '../src/utils/visitHelpers'

const positionOptions = [
  { value: '', label: 'Select position' },
  { value: 'Student', label: 'Student' },
  { value: 'Staff', label: 'Staff' },
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

function escapeExcelCell(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function VisitHistoryPage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Visit history')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [editVisit, setEditVisit] = useState(null)

  const [visits, setVisits] = useState([])
  const [patientRecords, setPatientRecords] = useState([])

  useEffect(() => {
    let ignore = false

    async function loadClinicData() {
      try {
        const [visitsResponse, recordsResponse] = await Promise.all([
          clinicApi.getVisits(),
          clinicApi.getPatientRecords(),
        ])
        if (!ignore) {
          setVisits(visitsResponse.data)
          setPatientRecords(recordsResponse.data)
        }
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load visit history.')
      }
    }

    loadClinicData()
    return () => {
      ignore = true
    }
  }, [])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Visit history') onNavigate(item)
    },
    [onNavigate]
  )

  const setNoticeSafe = useCallback((msg) => setNotice(msg), [])

  const openUpdateVisit = useCallback((visit) => {
    setSelectedVisit(visit)
setEditVisit({
      ...visit,
      name: visit.name || '',
      position: visit.position || 'Student',
      department: visit.department || '',
      studentId: visit.studentId || '',
      employeeId: visit.employeeId || '',
      course: visit.course || '',
      yearLevel: visit.yearLevel || '',
      section: visit.section || '',
      concern: visit.concern || 'General check-up',
      visitDateTime: toLocalDateTimeInputValue(visit.visitDateTime),
      dischargedAt: toLocalDateTimeInputValue(visit.dischargedAt),
    })
  }, [])

  const handleDeleteVisit = useCallback(async (visitToDelete) => {
    const confirmed = window.confirm('Are you sure you want to remove this record?')
    if (!confirmed) return

    try {
      await clinicApi.deleteVisit(visitToDelete.id, { deleteOrphanPatient: true })
      setVisits((current) => current.filter((visit) => visit.id !== visitToDelete.id))
      setNotice(`${visitToDelete.name}'s visit record has been removed.`)
    } catch (error) {
      setNotice(error.message || 'Unable to remove this visit.')
    }
  }, [])

  const handleUpdateVisit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!selectedVisit || !editVisit) return

const position = editVisit.position || 'Student'
      const isStudent = isStudentPosition(position)
      const nextVisit = {
        ...selectedVisit,
        name: editVisit.name.trim(),
        position,
        department: editVisit.department || '',
        studentId: isStudent ? editVisit.studentId.trim() : '',
        employeeId: isStaffPosition(position) ? editVisit.employeeId.trim() : '',
        course: isStudent ? editVisit.course || '' : '',
        yearLevel: isStudent ? editVisit.yearLevel || '' : '',
        section: isStudent ? editVisit.section.trim() : '',
        concern: editVisit.concern.trim() || 'General check-up',
        visitDateTime: editVisit.visitDateTime || selectedVisit.visitDateTime,
        dischargedAt: editVisit.dischargedAt || null,
        initials: getInitials(editVisit.name.trim()),
      }

      if (!nextVisit.name) {
        setNotice('Please enter a patient name.')
        return
      }

      try {
        const { data } = await clinicApi.updateVisit(selectedVisit.id, {
          ...nextVisit,
          medicines: selectedVisit.medicines || [],
        })
        setVisits((current) =>
          current.map((visit) => (visit.id === data.id ? data : visit))
        )
        setSelectedVisit(null)
        setEditVisit(null)
        setNotice(`${data.name}'s visit record has been updated.`)
      } catch (error) {
        setNotice(error.message || 'Unable to update this visit.')
      }
    },
    [editVisit, selectedVisit]
  )

  const filteredVisits = useMemo(() => {
    if (!query.trim()) return visits

    const q = query.toLowerCase()
return visits.filter((visit) =>
      [visit.name, visit.studentId, visit.employeeId, visit.position, visit.department, visit.course, visit.concern, ...(visit.medicines || [])]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    )
  }, [visits, query])

  const orderedVisits = useMemo(() => {
    return [...filteredVisits].sort((a, b) => {
      const left = new Date(a.visitDateTime || a.timestamp || a.dischargedAt || 0).getTime()
      const right = new Date(b.visitDateTime || b.timestamp || b.dischargedAt || 0).getTime()
      return left - right
    })
  }, [filteredVisits])

  const groupedVisits = useMemo(() => {
    const grouped = new Map()

    orderedVisits.forEach((visit) => {
      const visitDate = new Date(visit.visitDateTime || visit.timestamp || '')
      if (Number.isNaN(visitDate.getTime())) {
        const groupKey = 'Uncategorized'
        const group = grouped.get(groupKey) || []
        group.push(visit)
        grouped.set(groupKey, group)
        return
      }

      const groupKey = toLocalDateKey(visit.visitDateTime || visit.timestamp)
      const group = grouped.get(groupKey) || []
      group.push(visit)
      grouped.set(groupKey, group)
    })

    return [...grouped.entries()]
  }, [orderedVisits])

  const patientRecordLookup = useMemo(() => {
    const byRecordId = new Map()
    const byPatientRecordId = new Map()
    const byName = new Map()

    patientRecords.forEach((record) => {
      const recordId = record.studentId || record.employeeId || ''
      if (record.id) byPatientRecordId.set(String(record.id), record)
      if (recordId) byRecordId.set(recordId, record)
      if (record.name) byName.set(record.name.toLowerCase(), record)
    })

    return { byRecordId, byPatientRecordId, byName }
  }, [patientRecords])

  const getExportPatientDetails = useCallback(
    (visit) => {
      const visitRecordId = visit.studentId || visit.employeeId || ''
      const record =
        (visit.patientRecordId && patientRecordLookup.byPatientRecordId.get(String(visit.patientRecordId))) ||
        (visitRecordId && patientRecordLookup.byRecordId.get(visitRecordId)) ||
        (visit.name && patientRecordLookup.byName.get(visit.name.toLowerCase())) ||
        {}

      const position = visit.position || record.position || 'Student'
      const isStudent = isStudentPosition(position)

      return {
        name: visit.name || record.name || 'Walk-in',
        position,
        id: visitRecordId || record.studentId || record.employeeId || '',
        department: visit.department || record.department || '',
        course: isStudent ? visit.course || record.course || '' : '',
        yearLevel: isStudent ? visit.yearLevel || record.yearLevel || '' : '',
        block: isStudent ? visit.section || record.section || '' : '',
        contact: visit.contact || record.contact || '',
        address: visit.address || record.address || '',
      }
    },
    [patientRecordLookup]
  )

  const handleExportHistory = useCallback(() => {
const columns = [
      'Date',
      'Patient',
      'Position',
      'ID',
      'Department',
      'Course',
      'Year Level',
      'Block',
      'Contact Number',
      'Address',
      'Concern',
      'Time in',
      'Medicine',
      'Time out',
    ]

    const workbookRows = groupedVisits.map(([groupKey, groupVisits]) => {
      const dateLabel = groupKey === 'Uncategorized'
        ? 'Uncategorized'
        : new Date(`${groupKey}T00:00:00`).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })

      const groupRows = groupVisits.map((visit) => {
        const medicineValue = (visit.medicines || []).join(' / ') || 'No medicine'
        const patientDetails = getExportPatientDetails(visit)
        return `<tr>
          <td>${escapeExcelCell(groupKey === 'Uncategorized' ? 'Uncategorized' : groupKey)}</td>
          <td>${escapeExcelCell(patientDetails.name)}</td>
          <td>${escapeExcelCell(patientDetails.position)}</td>
          <td>${escapeExcelCell(patientDetails.id || 'No ID')}</td>
          <td>${escapeExcelCell(patientDetails.department)}</td>
          <td>${escapeExcelCell(patientDetails.course)}</td>
          <td>${escapeExcelCell(patientDetails.yearLevel)}</td>
          <td>${escapeExcelCell(patientDetails.block)}</td>
          <td>${escapeExcelCell(patientDetails.contact)}</td>
          <td>${escapeExcelCell(patientDetails.address)}</td>
          <td>${escapeExcelCell(visit.concern || 'General check-up')}</td>
          <td>${escapeExcelCell(formatVisitDate(visit.visitDateTime))}</td>
          <td>${escapeExcelCell(medicineValue)}</td>
          <td>${escapeExcelCell(visit.dischargedAt ? formatVisitDate(visit.dischargedAt) : 'Not timed out')}</td>
        </tr>`
      }).join('')

      return `<tr>
        <td colspan="${columns.length}" style="font-weight: bold; background: #eefaf2; color: #168c4a;">
          ${escapeExcelCell(dateLabel)}
        </td>
      </tr>
      ${groupRows}`
    }).join('')

    const workbookHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Visit History</title>
</head>
<body>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
    <thead>
      <tr>
        ${columns.map((column) => `<th style="background: #f6f8fc; color: #526582; text-transform: uppercase; font-size: 11px;">${escapeExcelCell(column)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${workbookRows}
    </tbody>
  </table>
</body>
</html>`

    const blob = new Blob([workbookHtml], {
      type: 'application/vnd.ms-excel;charset=utf-8;'
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'visit-history.xls'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)

    setNotice('Visit history exported to Excel.')
  }, [getExportPatientDetails, groupedVisits])

  const getAvatarTone = useCallback((visit) => getStatusTone(visit), [])

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
<p className="section-kicker">VISIT LOGS</p>
            <h2>Visit History</h2>
            <p>View and manage all clinic visits.</p>
          </div>
          <div className="hero-actions">
            <button className="primary-action" onClick={handleExportHistory}>
              <Icon name="download" /> Export Excel
            </button>
          </div>
        </section>

        <section className="history-panel panel">
          <div className="panel-heading">
            <div>
              <p className="panel-label green-text"><Icon name="calendar" /> VISIT RECORDS</p>
              <h3>
                {query
                  ? `Filtered (${filteredVisits.length})`
                  : `All visits (${visits.length})`}
              </h3>
            </div>
          </div>

          {visits.length === 0 ? (
            <p className="empty-state" style={{ marginTop: '32px' }}>
No visits recorded yet. Go to <strong>Students</strong> to register a clinic visit.
            </p>
          ) : filteredVisits.length === 0 ? (
            <p className="empty-state" style={{ marginTop: '32px' }}>
              No visits match your search criteria.
            </p>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Concern</th>
                    <th>Time in</th>
                    <th>Medicine</th>
                    <th>Time out</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedVisits.map(([groupKey, groupVisits]) => (
                    <Fragment key={groupKey}>
                      <tr className="history-date-category">
                        <td colSpan="6">
<span className="date-category-label">
                          <Icon name="calendar" /> {groupKey === 'Uncategorized' ? 'Uncategorized' : new Date(`${groupKey}T00:00:00`).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </td>
                      </tr>

                      {groupVisits.map((visit, index) => (
                        <tr key={`${visit.timestamp}-${index}`}>
                          <td>
                            <div className="history-student">
                              <span className={`visit-avatar ${getAvatarTone(visit)}`}>
                                {visit.initials || getInitials(visit.name)}
                              </span>
                              <div>
                                <strong>{visit.name}</strong>
                                <small>
                                  {visit.position ? `${visit.position} - ` : ''}
                                  {visit.studentId || visit.employeeId || 'No ID'}
                                  {visit.department ? ` - ${visit.department}` : ''}
                                  {visit.course ? ` - ${visit.course}` : ''}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="concern-chip">{visit.concern || 'General check-up'}</span>
                          </td>
                          <td>{formatVisitDate(visit.visitDateTime)}</td>
                          <td>
                            <div className="medicine-chip-list">
                              {(visit.medicines && visit.medicines.length > 0)
                                ? visit.medicines.map((medicine) => (
                                    <span key={medicine} className="medicine-chip">{medicine}</span>
                                  ))
                                : <span className="medicine-empty">No medicine</span>}
                            </div>
                          </td>
                          <td>{visit.dischargedAt ? formatVisitDate(visit.dischargedAt) : 'Not timed out'}</td>
                          <td>
                            <div className="history-actions">
                              <button
                                className="history-delete"
                                onClick={() => openUpdateVisit(visit)}
                                title="Update visit"
                              >
                                <Icon name="clipboard" /> Update
                              </button>
                              <button
                                className="history-delete danger"
                                onClick={() => handleDeleteVisit(visit)}
                                title="Remove visit record"
                              >
                                <Icon name="close" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {selectedVisit && editVisit && (
        <div className="modal-backdrop" onClick={() => {
          setSelectedVisit(null)
          setEditVisit(null)
        }}>
          <div className="visit-modal student-form-modal update-visit-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => {
              setSelectedVisit(null)
              setEditVisit(null)
            }}>
              <Icon name="close" />
            </button>
            <p className="section-kicker">UPDATE VISIT</p>
            <h2>Update visit record</h2>

<form onSubmit={handleUpdateVisit} className="modal-form-grid">
              <label>
                Full name *
                <input
                  value={editVisit.name}
                  onChange={(e) => setEditVisit((visit) => ({ ...visit, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Position
                <select
                  value={editVisit.position}
                  onChange={(e) => {
                    const position = e.target.value
                    setEditVisit((visit) => ({
                      ...visit,
                      position,
                      department: isDepartmentlessStaffPosition(position) ? '' : visit.department || '',
                      employeeId: isStaffPosition(position) ? visit.employeeId : '',
                      studentId: isStudentPosition(position) ? visit.studentId : '',
                      course: isStudentPosition(position) ? visit.course : '',
                      yearLevel: isStudentPosition(position) ? visit.yearLevel : '',
                      section: isStudentPosition(position) ? visit.section : '',
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
              {isStudentPosition(editVisit.position) && (
                <label>
                  Department
                  <select
                    value={editVisit.department}
                    onChange={(e) => {
                      const department = e.target.value
                      setEditVisit((visit) => ({
                        ...visit,
                        department,
                        course: departmentCourseOptions[department]?.some((option) => option.value === visit.course)
                          ? visit.course
                          : '',
                        yearLevel: departmentCourseOptions[department]?.some((option) => option.value === visit.course)
                          ? visit.yearLevel
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
              {!isStudentPosition(editVisit.position) && !isDepartmentlessStaffPosition(editVisit.position) && (
                <label>
                  Department
                  <select
                    value={editVisit.department}
                    onChange={(e) => setEditVisit((visit) => ({ ...visit, department: e.target.value }))}
                  >
                    {staffDepartmentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {isStudentPosition(editVisit.position) && (
                <>
                  <label>
                    Course
                    <select
                      value={editVisit.course}
                      onChange={(e) => {
                        const course = e.target.value
                        setEditVisit((visit) => ({
                          ...visit,
                          course,
                          yearLevel:
                            course === 'ACT' &&
                            !twoYearCourseOptions.some((option) => option.value === visit.yearLevel)
                              ? ''
                              : visit.yearLevel,
                        }))
                      }}
                    >
                      {getCourseOptions(editVisit.department).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Student ID
                    <input
                      value={editVisit.studentId}
                      onChange={(e) => setEditVisit((visit) => ({ ...visit, studentId: e.target.value }))}
                      placeholder="e.g. ICF-2024-001"
                    />
                  </label>
                  <label>
                    Year level
                    <select
                      value={editVisit.yearLevel}
                      onChange={(e) => setEditVisit((visit) => ({ ...visit, yearLevel: e.target.value }))}
                    >
                      {getYearLevelOptions(editVisit.course).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Block / Section
                    <input
                      value={editVisit.section}
                      onChange={(e) => setEditVisit((visit) => ({ ...visit, section: e.target.value }))}
                      placeholder="e.g. A"
                    />
                  </label>
                </>
              )}
              {!isStudentPosition(editVisit.position) && (
                <label>
                  Employee ID
                  <input
                    value={editVisit.employeeId}
                    onChange={(e) => setEditVisit((visit) => ({ ...visit, employeeId: e.target.value }))}
                    placeholder="e.g. EMP-2024-001"
                  />
                </label>
              )}
              <label>
                Concern
                <input
                  value={editVisit.concern}
                  onChange={(e) => setEditVisit((visit) => ({ ...visit, concern: e.target.value }))}
                  placeholder="e.g. Headache, fever, stomach pain"
                />
              </label>
              <label>
                Time in
                <input
                  type="datetime-local"
                  value={editVisit.visitDateTime}
                  onChange={(e) => setEditVisit((visit) => ({ ...visit, visitDateTime: e.target.value }))}
                />
              </label>
              <label>
                Time out
                <input
                  type="datetime-local"
                  value={editVisit.dischargedAt}
                  onChange={(e) => setEditVisit((visit) => ({ ...visit, dischargedAt: e.target.value }))}
                />
              </label>
              <button type="submit" className="primary-action form-submit">
                <Icon name="clipboard" /> Update visit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
