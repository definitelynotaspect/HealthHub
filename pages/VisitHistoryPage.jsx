import { Fragment, useState, useMemo, useCallback } from 'react'
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

function isSameVisit(left, right) {
  return (
    left.name === right.name &&
    left.timestamp === right.timestamp &&
    left.concern === right.concern
  )
}

function syncStudentsAfterVisitDelete(visitToDelete, remainingVisits) {
  const studentId = visitToDelete.studentId
  const studentName = visitToDelete.name
  const hasRemainingVisit = remainingVisits.some((visit) => {
    if (studentId) return visit.studentId === studentId
    return !visit.studentId && visit.name === studentName
  })

  if (hasRemainingVisit) return false

  const students = JSON.parse(localStorage.getItem('students') || '[]')
  const updatedStudents = students.filter((student) => {
    if (studentId) return student.studentId !== studentId
    return student.name !== studentName
  })

  localStorage.setItem('students', JSON.stringify(updatedStudents))
  return updatedStudents.length !== students.length
}

export default function VisitHistoryPage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Visit history')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
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
      studentId: visit.studentId || '',
      course: visit.course || '',
      concern: visit.concern || 'General check-up',
      visitDateTime: toDateTimeInputValue(visit.visitDateTime),
      dischargedAt: toDateTimeInputValue(visit.dischargedAt),
    })
  }, [])

  const handleDeleteVisit = useCallback((visitToDelete) => {
    const confirmed = window.confirm('Are you sure you want to remove this record?')
    if (!confirmed) return

    const updated = visits.filter((visit) => !isSameVisit(visit, visitToDelete))

    setVisits(updated)
    localStorage.setItem('visits', JSON.stringify(updated))

    try {
      const removedFromStudents = syncStudentsAfterVisitDelete(visitToDelete, updated)
      setNotice(
        removedFromStudents
          ? `${visitToDelete.name}'s visit and student record have been removed.`
          : `${visitToDelete.name}'s visit record has been removed.`
      )
    } catch {
      setNotice('Visit removed, but the student list could not be synced.')
    }
  }, [visits])

  const handleUpdateVisit = useCallback(
    (e) => {
      e.preventDefault()
      if (!selectedVisit || !editVisit) return

      const nextVisit = {
        ...selectedVisit,
        name: editVisit.name.trim(),
        studentId: editVisit.studentId.trim(),
        course: editVisit.course.trim(),
        concern: editVisit.concern.trim() || 'General check-up',
        visitDateTime: editVisit.visitDateTime || selectedVisit.visitDateTime,
        dischargedAt: editVisit.dischargedAt || null,
        initials: getInitials(editVisit.name.trim()),
      }

      if (!nextVisit.name) {
        setNotice('Please enter a student name.')
        return
      }

      const updated = visits.map((visit) =>
        isSameVisit(visit, selectedVisit) ? nextVisit : visit
      )

      setVisits(updated)
      localStorage.setItem('visits', JSON.stringify(updated))

      try {
        const students = JSON.parse(localStorage.getItem('students') || '[]')
        const existingIndex = students.findIndex((student) => student.studentId === selectedVisit.studentId)
        const nextStudent = {
          ...(existingIndex >= 0 ? students[existingIndex] : {}),
          studentId: nextVisit.studentId,
          name: nextVisit.name,
          course: nextVisit.course,
          yearLevel: nextVisit.yearLevel || '',
          section: nextVisit.section || '',
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
        setNotice('Visit updated, but student list could not be synced.')
        setSelectedVisit(null)
        setEditVisit(null)
        return
      }

      setSelectedVisit(null)
      setEditVisit(null)
      setNotice(`${nextVisit.name}'s visit record has been updated.`)
    },
    [editVisit, selectedVisit, visits]
  )

  const filteredVisits = useMemo(() => {
    if (!query.trim()) return visits

    const q = query.toLowerCase()
    return visits.filter((visit) =>
      [visit.name, visit.studentId, visit.course, visit.concern, ...(visit.medicines || [])]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    )
  }, [visits, query])

  const orderedVisits = useMemo(() => {
    return [...filteredVisits].sort((a, b) => {
      const left = new Date(a.visitDateTime || a.timestamp || a.dischargedAt || Date.now()).getTime()
      const right = new Date(b.visitDateTime || b.timestamp || b.dischargedAt || Date.now()).getTime()
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

      const groupKey = visitDate.toISOString().slice(0, 10)
      const group = grouped.get(groupKey) || []
      group.push(visit)
      grouped.set(groupKey, group)
    })

    return [...grouped.entries()]
  }, [orderedVisits])

  const handleExportHistory = useCallback(() => {
    const columns = ['Date', 'Student', 'Concern', 'Time in', 'Medicine', 'Time out']

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
        return `<tr>
          <td>${groupKey === 'Uncategorized' ? 'Uncategorized' : groupKey}</td>
          <td>${visit.name || 'Walk-in'}${visit.studentId ? ` (${visit.studentId})` : ''}</td>
          <td>${visit.concern || 'General check-up'}</td>
          <td>${formatVisitDate(visit.visitDateTime)}</td>
          <td>${medicineValue}</td>
          <td>${visit.dischargedAt ? formatVisitDate(visit.dischargedAt) : 'Not timed out'}</td>
        </tr>`
      }).join('')

      return `<tr>
        <td colspan="6" style="font-weight: bold; background: #eefaf2; color: #168c4a;">
          ${dateLabel}
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
        ${columns.map((column) => `<th style="background: #f6f8fc; color: #526582; text-transform: uppercase; font-size: 11px;">${column}</th>`).join('')}
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
  }, [groupedVisits])

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
            <p>View and manage all student clinic visits.</p>
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
              No visits recorded yet. Go to <strong>Students</strong> to register a student visit.
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
                    <th>Date</th>
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
                        <td colSpan="7">
                          <span className="date-category-label">
                     x       <Icon name="calendar" /> {groupKey === 'Uncategorized' ? 'Uncategorized' : new Date(`${groupKey}T00:00:00`).toLocaleDateString('en-US', {
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
                          <td>{visit.visitDateTime ? new Date(visit.visitDateTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          }) : 'N/A'}</td>
                          <td>
                            <div className="history-student">
                              <span className={`visit-avatar ${getAvatarTone(visit)}`}>
                                {visit.initials || getInitials(visit.name)}
                              </span>
                              <div>
                                <strong>{visit.name}</strong>
                                <small>
                                  {visit.studentId || 'No student ID'}
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
