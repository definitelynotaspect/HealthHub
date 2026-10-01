import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { getCachedArray, hasCachedArray, setCachedArray } from '../src/utils/clinicDataCache'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import ConfirmDialog from '../src/components/ConfirmDialog'
import { formatVisitDate, getInitials, getStatusTone, getVisitMajorComplaint, toLocalDateTimeInputValue } from '../src/utils/visitHelpers'

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

export default function ConcernPage({
  onSignOut,
  onNavigate,
  onOpenAccountSettings,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onCloseMobileSidebar,
}) {
  const [activeNav, setActiveNav] = useState('Concern Page')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedConcerns, setSelectedConcerns] = useState([])
  const [concernFilterOpen, setConcernFilterOpen] = useState(false)
  const [concernSearch, setConcernSearch] = useState('')
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [editVisit, setEditVisit] = useState(null)
  const [visitToDischarge, setVisitToDischarge] = useState(null)
  const [isDischarging, setIsDischarging] = useState(false)
  const concernFilterRef = useRef(null)

  const [visits, setVisits] = useState(() => getCachedArray('visits'))
  const [visitsLoaded, setVisitsLoaded] = useState(() => hasCachedArray('visits'))

  useEffect(() => {
    let ignore = false

    async function loadVisits() {
      try {
        const { data } = await clinicApi.getVisits()
        if (!ignore) {
          setVisits(setCachedArray('visits', data))
          setVisitsLoaded(true)
        }
      } catch (error) {
        if (!ignore) setNotice(error.message || 'Unable to load concerns.')
      } finally {
        if (!ignore) setVisitsLoaded(true)
      }
    }

    loadVisits()
    return () => {
      ignore = true
    }
  }, [])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Concern Page') onNavigate(item)
    },
    [onNavigate]
  )

  const concerns = useMemo(() => {
    const unique = new Set()
    visits.forEach((visit) => unique.add(getVisitMajorComplaint(visit)))
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [visits])

  const visibleConcerns = useMemo(() => {
    const q = concernSearch.trim().toLowerCase()
    if (!q) return concerns
    return concerns.filter((concern) => concern.toLowerCase().includes(q))
  }, [concerns, concernSearch])

  const filteredVisits = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visits.filter((visit) => {
      const concern = getVisitMajorComplaint(visit)
      const matchesConcern = selectedConcerns.length === 0 || selectedConcerns.includes(concern)
      const matchesQuery =
        !q ||
        [
          visit.name,
          visit.studentId,
          visit.employeeId,
          visit.position,
          visit.department,
          visit.course,
          visit.yearLevel,
          visit.section,
          concern,
          ...(visit.medicines || []),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(q))

      return matchesConcern && matchesQuery
    })
  }, [visits, query, selectedConcerns])

  useEffect(() => {
    setSelectedConcerns((current) => current.filter((concern) => concerns.includes(concern)))
  }, [concerns])

  useEffect(() => {
    if (!concernFilterOpen) return undefined

    function handlePointerDown(event) {
      if (concernFilterRef.current && !concernFilterRef.current.contains(event.target)) {
        setConcernFilterOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setConcernFilterOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [concernFilterOpen])

  const stats = useMemo(() => {
    const patientIds = new Set()
    const patientNames = new Set()
    visits.forEach((visit) => {
      if (visit.studentId) patientIds.add(visit.studentId)
      else if (visit.employeeId) patientIds.add(visit.employeeId)
      else if (visit.name) patientNames.add(visit.name.toLowerCase())
    })

    return {
      patients: patientIds.size + patientNames.size,
      concerns: concerns.length,
      active: visits.filter((visit) => !visit.dischargedAt).length,
      records: visits.length,
    }
  }, [visits, concerns])

  const handleDischarge = useCallback(
    async () => {
      if (!visitToDischarge) return

      setIsDischarging(true)
      try {
        const { data } = await clinicApi.dischargeVisit(visitToDischarge.id)
        setVisits((current) => {
          const nextVisits = current.map((item) => (item.id === data.id ? data : item))
          setCachedArray('visits', nextVisits)
          return nextVisits
        })
        setSelectedVisit(null)
        setNotice(`${visitToDischarge.name} has been timed out from the clinic.`)
        setVisitToDischarge(null)
      } catch (error) {
        setNotice(error.message || 'Unable to time out this visit.')
      } finally {
        setIsDischarging(false)
      }
    },
    [visitToDischarge]
  )

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
      concern: getVisitMajorComplaint(visit),
      signsSymptoms: visit.signsSymptoms || getVisitMajorComplaint(visit),
      visitDateTime: toLocalDateTimeInputValue(visit.visitDateTime),
      dischargedAt: toLocalDateTimeInputValue(visit.dischargedAt),
    })
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
        concern: String(editVisit.signsSymptoms || '').trim() || 'General check-up',
        signsSymptoms: String(editVisit.signsSymptoms || '').trim(),
        visitDateTime: editVisit.visitDateTime || selectedVisit.visitDateTime,
        dischargedAt: editVisit.dischargedAt || null,
        medicines: selectedVisit.medicines || [],
        initials: getInitials(editVisit.name.trim()),
      }

      if (!nextVisit.name) {
        setNotice('Please enter a patient name.')
        return
      }

      try {
        const { data } = await clinicApi.updateVisit(selectedVisit.id, nextVisit)
        setVisits((current) => {
          const nextVisits = current.map((visit) => (visit.id === data.id ? data : visit))
          setCachedArray('visits', nextVisits)
          return nextVisits
        })
        setSelectedVisit(null)
        setEditVisit(null)
        setNotice(`${data.name}'s concern has been updated.`)
      } catch (error) {
        setNotice(error.message || 'Unable to update concern.')
      }
    },
    [editVisit, selectedVisit]
  )

  const getAvatarTone = useCallback((visit) => getStatusTone(visit), [])
  const setNoticeSafe = useCallback((msg) => setNotice(msg), [])

  const toggleConcernFilter = useCallback((concern) => {
    setSelectedConcerns((current) =>
      current.includes(concern)
        ? current.filter((item) => item !== concern)
        : [...current, concern]
    )
  }, [])

  return (
    <div className="app-layout">
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
            <p className="section-kicker">PATIENT CONCERNS</p>
            <h2>Concern Page</h2>
            <p>Review every patient concern and manage each clinic record.</p>
          </div>
          <button className="primary-action" onClick={() => handleNavSelect('Patients')}>
            <Icon name="plus" /> Register visit
          </button>
        </section>

        {visits.length > 0 && (
          <section className="stats-grid" aria-label="Concern statistics">
            <div className="stat-card blue">
              <span className="stat-icon"><Icon name="students" /></span>
              <div>
                <strong>{stats.patients}</strong>
                <p>Total patients</p>
                <small>Visitors with concern records</small>
              </div>
            </div>
            <div className="stat-card red">
              <span className="stat-icon"><Icon name="heart" /></span>
              <div>
                <strong>{stats.concerns}</strong>
                <p>Concern types</p>
                <small>Unique reasons for visit</small>
              </div>
            </div>
            <div className="stat-card yellow">
              <span className="stat-icon"><Icon name="calendar" /></span>
              <div>
                <strong>{stats.active}</strong>
                <p>Active cases</p>
                <small>Not yet timed out</small>
              </div>
            </div>
            <div className="stat-card green">
              <span className="stat-icon"><Icon name="clipboard" /></span>
              <div>
                <strong>{stats.records}</strong>
                <p>Total records</p>
                <small>All listed concerns</small>
              </div>
            </div>
          </section>
        )}

        {visits.length > 0 && (
          <div className="concern-filter-bar" ref={concernFilterRef}>
            <button
              type="button"
              className="concern-filter-trigger"
              onClick={() => setConcernFilterOpen((open) => !open)}
              aria-expanded={concernFilterOpen}
            >
              <span><Icon name="search" /> Concern filter</span>
              <strong>
                {selectedConcerns.length === 0
                  ? `All concerns (${visits.length})`
                  : `${selectedConcerns.length} selected`}
              </strong>
            </button>

            {selectedConcerns.length > 0 && (
              <button
                type="button"
                className="concern-filter-clear"
                onClick={() => setSelectedConcerns([])}
              >
                Clear
              </button>
            )}

            {concernFilterOpen && (
              <div className="concern-filter-menu">
                <label className="concern-filter-search">
                  <Icon name="search" />
                  <input
                    value={concernSearch}
                    onChange={(e) => setConcernSearch(e.target.value)}
                    placeholder="Search concern types"
                    autoFocus
                  />
                </label>

                <div className="concern-filter-actions">
                  <button
                    type="button"
                    onClick={() => setSelectedConcerns(concerns)}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedConcerns([])}
                  >
                    Clear
                  </button>
                </div>

                <div className="concern-filter-options">
                  {visibleConcerns.length === 0 ? (
                    <p>No concern types found.</p>
                  ) : (
                    visibleConcerns.map((concern) => (
                      <label key={concern} className="concern-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedConcerns.includes(concern)}
                          onChange={() => toggleConcernFilter(concern)}
                        />
                        <span>{concern}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <section className="concern-panel panel">
          <div className="panel-heading">
            <div>
              <p className="panel-label red-text"><Icon name="clipboard" /> CONCERN LIST</p>
              <h3>
                {query || selectedConcerns.length > 0
                  ? `Filtered concerns (${filteredVisits.length})`
                  : `All patient concerns (${visits.length})`}
              </h3>
            </div>
          </div>

          {visits.length === 0 && !visitsLoaded ? (
            <p className="empty-state" style={{ marginTop: '32px' }}>
              Loading concerns...
            </p>
          ) : visits.length === 0 ? (
            <p className="empty-state" style={{ marginTop: '32px' }}>
              No concerns recorded yet. Go to <strong>Students</strong> to register a visit.
            </p>
          ) : filteredVisits.length === 0 ? (
            <p className="empty-state" style={{ marginTop: '32px' }}>
              No patient concerns match your search.
            </p>
          ) : (
            <div className="concern-table-wrap">
              <table className="concern-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Major Complaint</th>
                    <th>Visit date</th>
                    <th>Medicine</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.map((visit, index) => (
                    <tr key={`${visit.timestamp}-${visit.studentId || visit.name}-${index}`}>
                      <td data-label="Patient">
                        <div className="concern-patient">
                          <span className={`visit-avatar ${getAvatarTone(visit)}`}>
                            {visit.initials || getInitials(visit.name)}
                          </span>
                          <div>
                            <strong>{visit.name}</strong>
                            <small>
                              {visit.position ? `${visit.position} · ` : ''}
                              {visit.studentId || visit.employeeId || 'No ID'}
                              {visit.department ? ` · ${visit.department}` : ''}
                              {visit.course ? ` · ${visit.course}` : ''}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Major Complaint">
                        <span className="concern-chip">{getVisitMajorComplaint(visit)}</span>
                      </td>
                      <td data-label="Visit Date">{formatVisitDate(visit.visitDateTime)}</td>
                      <td data-label="Medicine">
                        <div className="medicine-chip-list">
                          {(visit.medicines && visit.medicines.length > 0)
                            ? visit.medicines.map((medicine) => (
                                <span key={medicine} className="medicine-chip">{medicine}</span>
                              ))
                            : <span className="medicine-empty">No medicine</span>}
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className={visit.dischargedAt ? 'status-pill done' : 'status-pill active'}>
                          {visit.dischargedAt ? 'Timed out' : 'Active'}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className="table-actions">
                          <button onClick={() => openUpdateVisit(visit)}>Update</button>
                          {!visit.dischargedAt && (
                            <button onClick={() => setVisitToDischarge(visit)}>Time out</button>
                          )}
                        </div>
                      </td>
                    </tr>
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
          <div className="visit-modal student-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => {
              setSelectedVisit(null)
              setEditVisit(null)
            }}>
              <Icon name="close" />
            </button>
            <p className="section-kicker">UPDATE CONCERN</p>
            <div className="detail-header">
              <span className={`visit-avatar ${getAvatarTone(editVisit)}`} style={{ width: 48, height: 48, fontSize: '.85rem' }}>
                {editVisit.initials || getInitials(editVisit.name)}
              </span>
              <div>
                <h2>{editVisit.name}</h2>
                <p className="detail-id">
                  {editVisit.position ? `${editVisit.position} · ` : ''}
                  {editVisit.studentId || editVisit.employeeId || 'No ID'}
                  {editVisit.department ? ` · ${editVisit.department}` : ''}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateVisit} className="modal-form-grid">
              <label>
                Patient name *
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
                Signs and symptoms / major complaint
                <input
                  value={editVisit.signsSymptoms}
                  onChange={(e) => setEditVisit((visit) => ({ ...visit, signsSymptoms: e.target.value }))}
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
                <Icon name="clipboard" /> Update concern
              </button>
            </form>
          </div>
        </div>
      )}

      {visitToDischarge && (
        <ConfirmDialog
          title="Time out patient?"
          description={`Mark ${visitToDischarge.name} as having left the clinic?`}
          warning="The visit will remain in the history, but it will no longer appear as active."
          confirmLabel="Time out"
          loadingLabel="Timing out..."
          loading={isDischarging}
          onCancel={() => setVisitToDischarge(null)}
          onConfirm={handleDischarge}
        />
      )}
    </div>
  )
}
