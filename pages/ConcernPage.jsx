import { useState, useMemo, useCallback, useEffect } from 'react'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import { formatVisitDate, getInitials, getStatusTone } from '../src/utils/visitHelpers'

function toDateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60000)
  return localDate.toISOString().slice(0, 16)
}

export default function ConcernPage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Concern Page')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedConcern, setSelectedConcern] = useState('')
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [editVisit, setEditVisit] = useState(null)

  const [visits, setVisits] = useState(() => {
    try {
      const saved = localStorage.getItem('visits')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('visits', JSON.stringify(visits))
  }, [visits])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Concern Page') onNavigate(item)
    },
    [onNavigate]
  )

  const concerns = useMemo(() => {
    const unique = new Set()
    visits.forEach((visit) => unique.add(visit.concern || 'General check-up'))
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [visits])

  const filteredVisits = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visits.filter((visit) => {
      const concern = visit.concern || 'General check-up'
      const matchesConcern = !selectedConcern || concern === selectedConcern
      const matchesQuery =
        !q ||
        [
          visit.name,
          visit.studentId,
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
  }, [visits, query, selectedConcern])

  const stats = useMemo(() => {
    const patientIds = new Set()
    const patientNames = new Set()
    visits.forEach((visit) => {
      if (visit.studentId) patientIds.add(visit.studentId)
      else if (visit.name) patientNames.add(visit.name.toLowerCase())
    })

    return {
      patients: patientIds.size + patientNames.size,
      concerns: concerns.length,
      active: visits.filter((visit) => !visit.dischargedAt).length,
      records: visits.length,
    }
  }, [visits, concerns])

  const updateMatchingVisit = useCallback((targetVisit, updater) => {
    setVisits((current) =>
      current.map((visit) =>
        visit.name === targetVisit.name &&
        visit.timestamp === targetVisit.timestamp &&
        visit.concern === targetVisit.concern
          ? updater(visit)
          : visit
      )
    )
  }, [])

  const handleDischarge = useCallback(
    (visit) => {
      updateMatchingVisit(visit, (current) => ({
        ...current,
        dischargedAt: current.dischargedAt || new Date().toISOString(),
      }))
      setSelectedVisit(null)
      setNotice(`${visit.name} has been timed out from the clinic.`)
    },
    [updateMatchingVisit]
  )

  const openUpdateVisit = useCallback((visit) => {
    setSelectedVisit(visit)
    setEditVisit({
      ...visit,
      name: visit.name || '',
      studentId: visit.studentId || '',
      course: visit.course || '',
      yearLevel: visit.yearLevel || '',
      section: visit.section || '',
      concern: visit.concern || 'General check-up',
      visitDateTime: toDateTimeInputValue(visit.visitDateTime),
      dischargedAt: toDateTimeInputValue(visit.dischargedAt),
    })
  }, [])

  const handleUpdateVisit = useCallback(
    (e) => {
      e.preventDefault()
      if (!selectedVisit || !editVisit) return

      const nextVisit = {
        ...selectedVisit,
        name: editVisit.name.trim(),
        studentId: editVisit.studentId.trim(),
        course: editVisit.course.trim(),
        yearLevel: editVisit.yearLevel,
        section: editVisit.section.trim(),
        concern: editVisit.concern.trim() || 'General check-up',
        visitDateTime: editVisit.visitDateTime || selectedVisit.visitDateTime,
        dischargedAt: editVisit.dischargedAt || null,
        initials: getInitials(editVisit.name.trim()),
      }

      if (!nextVisit.name) {
        setNotice('Please enter a patient name.')
        return
      }

      updateMatchingVisit(selectedVisit, () => nextVisit)

      try {
        const students = JSON.parse(localStorage.getItem('students') || '[]')
        const existingIndex = students.findIndex((student) => student.studentId === selectedVisit.studentId)
        const nextStudent = {
          ...(existingIndex >= 0 ? students[existingIndex] : {}),
          studentId: nextVisit.studentId,
          name: nextVisit.name,
          course: nextVisit.course,
          yearLevel: nextVisit.yearLevel,
          section: nextVisit.section,
          contact: existingIndex >= 0 ? students[existingIndex].contact || '' : '',
          address: existingIndex >= 0 ? students[existingIndex].address || '' : '',
          registeredAt: existingIndex >= 0 ? students[existingIndex].registeredAt : nextVisit.visitDateTime,
        }

        if (nextStudent.studentId) {
          if (existingIndex >= 0) students[existingIndex] = nextStudent
          else students.unshift(nextStudent)
          localStorage.setItem('students', JSON.stringify(students))
        }
      } catch {
        setNotice('Concern updated, but student list could not be synced.')
        setSelectedVisit(null)
        setEditVisit(null)
        return
      }

      setSelectedVisit(null)
      setEditVisit(null)
      setNotice(`${nextVisit.name}'s concern has been updated.`)
    },
    [editVisit, selectedVisit, updateMatchingVisit]
  )

  const getAvatarTone = useCallback((visit) => getStatusTone(visit), [])
  const setNoticeSafe = useCallback((msg) => setNotice(msg), [])

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
            <p className="section-kicker">PATIENT CONCERNS</p>
            <h2>Concern Page</h2>
            <p>Review every patient concern and manage each clinic record.</p>
          </div>
          <button className="primary-action" onClick={() => handleNavSelect('Students')}>
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
                <small>Students with concern records</small>
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
          <div className="history-filters">
            <div className="segmented">
              <button
                className={selectedConcern === '' ? 'selected' : ''}
                onClick={() => setSelectedConcern('')}
              >
                All ({visits.length})
              </button>
              {concerns.slice(0, 6).map((concern) => (
                <button
                  key={concern}
                  className={selectedConcern === concern ? 'selected' : ''}
                  onClick={() => setSelectedConcern(concern)}
                >
                  {concern}
                </button>
              ))}
            </div>
          </div>
        )}

        <section className="concern-panel panel">
          <div className="panel-heading">
            <div>
              <p className="panel-label red-text"><Icon name="clipboard" /> CONCERN LIST</p>
              <h3>
                {query || selectedConcern
                  ? `Filtered concerns (${filteredVisits.length})`
                  : `All patient concerns (${visits.length})`}
              </h3>
            </div>
          </div>

          {visits.length === 0 ? (
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
                    <th>Concern</th>
                    <th>Visit date</th>
                    <th>Medicine</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.map((visit, index) => (
                    <tr key={`${visit.timestamp}-${visit.studentId || visit.name}-${index}`}>
                      <td>
                        <div className="concern-patient">
                          <span className={`visit-avatar ${getAvatarTone(visit)}`}>
                            {visit.initials || getInitials(visit.name)}
                          </span>
                          <div>
                            <strong>{visit.name}</strong>
                            <small>
                              {visit.studentId || 'No student ID'}
                              {visit.course ? ` · ${visit.course}` : ''}
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
                      <td>
                        <span className={visit.dischargedAt ? 'status-pill done' : 'status-pill active'}>
                          {visit.dischargedAt ? 'Timed out' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button onClick={() => openUpdateVisit(visit)}>Update</button>
                          {!visit.dischargedAt && (
                            <button onClick={() => handleDischarge(visit)}>Time out</button>
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
                <p className="detail-id">{editVisit.studentId || 'No student ID'}</p>
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
                Student ID
                <input
                  value={editVisit.studentId}
                  onChange={(e) => setEditVisit((visit) => ({ ...visit, studentId: e.target.value }))}
                />
              </label>
              <label>
                Course
                <input
                  value={editVisit.course}
                  onChange={(e) => setEditVisit((visit) => ({ ...visit, course: e.target.value }))}
                />
              </label>
              <label>
                Concern
                <input
                  value={editVisit.concern}
                  onChange={(e) => setEditVisit((visit) => ({ ...visit, concern: e.target.value }))}
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
              <button type="submit" className="primary-action" style={{ gridColumn: '1 / -1', justifyContent: 'center' }}>
                <Icon name="clipboard" /> Update concern
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
