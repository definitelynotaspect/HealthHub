import { useState, useMemo, useCallback, useEffect } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { formatVisitDate, getVisitMajorComplaint } from '../src/utils/visitHelpers'
import { getCachedArray, hasCachedArray, setCachedArray } from '../src/utils/clinicDataCache'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import VisitBarChart from '../src/components/VisitBarChart'
import ConfirmDialog from '../src/components/ConfirmDialog'

function toMonthValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getWeekNumberForDate(date) {
  return Math.ceil(date.getDate() / 7)
}

function getMonthLabel(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function getWeekOptions(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const weekCount = Math.ceil(lastDay / 7)

  return Array.from({ length: weekCount }, (_, index) => {
    const week = index + 1
    const startDay = index * 7 + 1
    const endDay = Math.min(startDay + 6, lastDay)
    const start = new Date(year, month - 1, startDay).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const end = new Date(year, month - 1, endDay).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })

    return {
      value: String(week),
      label: `Week ${week} (${start} - ${end})`,
    }
  })
}

export default function DashboardPage({
  onSignOut,
  onNavigate,
  onOpenAccountSettings,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onCloseMobileSidebar,
}) {
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date()))
  const [selectedWeek, setSelectedWeek] = useState(() => String(getWeekNumberForDate(new Date())))
  const [visits, setVisits] = useState(() => getCachedArray('visits'))
  const [visitsLoaded, setVisitsLoaded] = useState(() => hasCachedArray('visits'))
  const [visitToDischarge, setVisitToDischarge] = useState(null)
  const [isDischarging, setIsDischarging] = useState(false)

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
        if (!ignore) setNotice(error.message || 'Unable to load clinic visits.')
      } finally {
        if (!ignore) setVisitsLoaded(true)
      }
    }

    loadVisits()
    return () => {
      ignore = true
    }
  }, [])

  // Separate active (undischarged) and discharged visits
  const activeVisits = useMemo(
    () => visits.filter((v) => !v.dischargedAt),
    [visits]
  )

  const dischargedVisits = useMemo(
    () => visits.filter((v) => v.dischargedAt),
    [visits]
  )

  // Dynamically count major complaints from actual visits
  const concernCounts = useMemo(() => {
    const counts = {}
    visits.forEach((v) => {
      const c = getVisitMajorComplaint(v)
      counts[c] = (counts[c] || 0) + 1
    })
    return counts
  }, [visits])

  // Top complaints sorted by frequency
  const topConcerns = useMemo(() => {
    return Object.entries(concernCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [concernCounts])

  const concernTypeCount = useMemo(
    () => Object.keys(concernCounts).length,
    [concernCounts]
  )

  const dischargedToday = useMemo(() => {
    const today = new Date()
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')

    return dischargedVisits.filter((visit) => {
      const dischargedAt = visit.dischargedAt
      if (!dischargedAt) return false

      const localDate = String(dischargedAt).match(/^(\d{4}-\d{2}-\d{2})/)
      if (localDate) return localDate[1] === todayKey

      const date = new Date(dischargedAt)
      return !Number.isNaN(date.getTime())
        && [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') === todayKey
    })
  }, [dischargedVisits])

  // Colors for top concerns
  const concernColors = ['#e4342a', '#f1bc10', '#168c4a', '#1d4eb5', '#9b59b6']

  const monthOptions = useMemo(() => {
    const months = new Set([toMonthValue(new Date())])

    visits.forEach((visit) => {
      const value = visit.visitDateTime || visit.timestamp
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) months.add(toMonthValue(date))
    })

    return Array.from(months)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({
        value,
        label: getMonthLabel(value),
      }))
  }, [visits])

  const weekOptions = useMemo(() => getWeekOptions(selectedMonth), [selectedMonth])

  const handleNavSelect = useCallback((item) => {
    setActiveNav(item)
    if (item !== 'Dashboard') {
      onNavigate(item)
    }
  }, [onNavigate])

  // Discharge a student (mark them as left the clinic)
  const handleDischarge = useCallback(async () => {
    if (!visitToDischarge) return
    setIsDischarging(true)
    try {
      const { data } = await clinicApi.dischargeVisit(visitToDischarge.id)
      setVisits((current) => {
        const nextVisits = current.map((visit) => (visit.id === data.id ? data : visit))
        setCachedArray('visits', nextVisits)
        return nextVisits
      })
      setNotice(`${visitToDischarge.name} has been discharged from the clinic.`)
      setVisitToDischarge(null)
    } catch (error) {
      setNotice(error.message || 'Unable to discharge this visit.')
    } finally {
      setIsDischarging(false)
    }
  }, [visitToDischarge])

  const setNoticeSafe = useCallback((msg) => setNotice(msg), [])

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
          showSearch={false}
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">SCHOOL CLINIC</p>
            <h2>School Clinic</h2>
            <p>Record and manage student clinic visits.</p>
          </div>
          <button className="primary-action" onClick={() => handleNavSelect('Patients')}>
            <Icon name="students" /> Manage patients
          </button>
        </section>

        {visits.length > 0 && (
          <>
            <section className="stats-grid" aria-label="Clinic statistics">
              <button type="button" className="stat-card blue interactive-stat-card" onClick={() => handleNavSelect('Visit history')}>
                <span className="stat-icon"><Icon name="students" /></span>
                <div>
                  <strong>{visits.length}</strong>
                  <p>Total visits recorded</p>
                  <small>All time clinic visits</small>
                </div>
              </button>
              <button type="button" className="stat-card yellow interactive-stat-card" onClick={() => handleNavSelect('Visit history')}>
                <span className="stat-icon"><Icon name="calendar" /></span>
                <div>
                  <strong>{activeVisits.length}</strong>
                  <p>Currently in clinic</p>
                  <small>{activeVisits.length === 1 ? '1 student being attended' : `${activeVisits.length} students being attended`}</small>
                </div>
              </button>
              <button type="button" className="stat-card red interactive-stat-card" onClick={() => handleNavSelect('Concern Page')}>
                <span className="stat-icon"><Icon name="heart" /></span>
                <div>
                  <strong>{concernTypeCount}</strong>
                  <p>Unique complaints</p>
                  <small>{topConcerns.length === 0 ? 'No complaints recorded' : `${topConcerns[0]?.[0] || 'N/A'} is most common`}</small>
                </div>
              </button>
              <button type="button" className="stat-card green interactive-stat-card" onClick={() => handleNavSelect('Visit history')}>
                <span className="stat-icon"><Icon name="clipboard" /></span>
                <div>
                  <strong>{dischargedToday.length}</strong>
                  <p>Discharged today</p>
                  <small>{dischargedToday.length === 1 ? '1 student discharged' : `${dischargedToday.length} students discharged`}</small>
                </div>
              </button>
            </section>

            {topConcerns.length > 0 && (
              <section className="dashboard-grid">
                <div className="panel trend-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="panel-label"><Icon name="chart" /> VISITS OVERVIEW</p>
                      <h3>Clinic visits</h3>
                    </div>
                    <div className="chart-filter-group">
                      <label>
                        Month
                        <select
                          value={selectedMonth}
                          onChange={(e) => {
                            const nextMonth = e.target.value
                            setSelectedMonth(nextMonth)
                            const today = new Date()
                            setSelectedWeek(
                              nextMonth === toMonthValue(today)
                                ? String(getWeekNumberForDate(today))
                                : '1'
                            )
                          }}
                        >
                          {monthOptions.map((month) => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Week
                        <select
                          value={selectedWeek}
                          onChange={(e) => setSelectedWeek(e.target.value)}
                        >
                          {weekOptions.map((week) => (
                            <option key={week.value} value={week.value}>
                              {week.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <VisitBarChart
                    visits={visits}
                    monthValue={selectedMonth}
                    weekNumber={selectedWeek}
                  />
                </div>

                <div className="panel complaints-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="panel-label red-text"><Icon name="heart" /> COMMON COMPLAINTS</p>
                      <h3>Top complaints</h3>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => handleNavSelect('Concern Page')}
                    >
                      View all <Icon name="arrow" />
                    </button>
                  </div>
                  <div style={{ padding: '10px 0' }}>
                    {topConcerns.length === 0 ? (
                      <p className="empty-state">No complaints recorded yet.</p>
                    ) : (
                      <>
                        <div
                          className="donut"
                          style={{
                            background: `conic-gradient(${topConcerns.map(([, count], i) => {
                              const total = topConcerns.reduce((s, [, c]) => s + c, 0)
                              const from = topConcerns.slice(0, i).reduce((s, [, c]) => s + c, 0)
                              return `${concernColors[i % concernColors.length]} ${(from / total) * 100}% ${((from + count) / total) * 100}%`
                            }).join(', ')})`
                          }}
                        >
                          <div>
                            <strong>{visits.length}</strong>
                            <span>consultations</span>
                          </div>
                        </div>
                        <div className="legend">
                          {topConcerns.map(([concern, count], i) => {
                            const total = topConcerns.reduce((s, [, c]) => s + c, 0)
                            return (
                              <button
                                type="button"
                                key={concern}
                                className="legend-item"
                                onClick={() => handleNavSelect('Concern Page')}
                                aria-label={`View ${concern} complaint records`}
                              >
                                <i style={{ background: concernColors[i % concernColors.length] }} />
                                {concern}
                                <b>{Math.round((count / total) * 100)}%</b>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Active visits section - students currently in clinic */}
            <section className="bottom-grid">
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="panel-label yellow-text"><Icon name="heart" /> CURRENTLY IN CLINIC</p>
                    <h3>Active visits ({activeVisits.length})</h3>
                  </div>
                  <button className="text-button" onClick={() => handleNavSelect('Visit history')}>
                    View all <Icon name="arrow" />
                  </button>
                </div>
                {activeVisits.length === 0 ? (
                  <p className="empty-state" style={{ marginTop: '16px' }}>No active visits. All students have been discharged.</p>
                ) : (
                  <div className="visit-list">
                    {activeVisits.slice(0, 6).map((visit) => (
                      <div key={`${visit.name}-${visit.timestamp}`} className="visit active-visit">
                        <span className={`visit-avatar ${visit.tone}`}>{visit.initials}</span>
                        <span className="visit-info">
                          <strong>{visit.name}</strong>
                          <small>
                            {getVisitMajorComplaint(visit)}
                            {visit.course ? ` · ${visit.course}` : ''}
                          </small>
                        </span>
                        <button
                          className="discharge-button"
                          onClick={() => setVisitToDischarge(visit)}
                          title="Discharge student from clinic"
                        >
                          <Icon name="close" /> Time out
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel quick-panel">
                <p className="panel-label yellow-text">QUICK ACTIONS</p>
                <h3>Manage clinic</h3>
                <div className="quick-actions">
                  <button onClick={() => handleNavSelect('Patients')}>
                    <Icon name="students" /><span>Find a<br />patient</span>
                  </button>
                  <button onClick={() => handleNavSelect('Visit history')}>
                    <Icon name="history" /><span>View visit<br />history</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Recently discharged section */}
            {dischargedToday.length > 0 && (
              <section className="panel" style={{ marginTop: '18px' }}>
                <div className="panel-heading">
                  <div>
                    <p className="panel-label green-text"><Icon name="calendar" /> RECENTLY DISCHARGED</p>
                    <h3>Discharged today ({dischargedToday.length})</h3>
                  </div>
                  <button className="text-button" onClick={() => handleNavSelect('Visit history')}>
                    View history <Icon name="arrow" />
                  </button>
                </div>
                <div className="visit-list">
                  {dischargedToday.slice(0, 5).map((visit) => (
                    <div key={`${visit.name}-${visit.timestamp}`} className="visit discharged-visit">
                      <span className={`visit-avatar green`}>{visit.initials}</span>
                      <span className="visit-info">
                        <strong>{visit.name}</strong>
                        <small>
                          {getVisitMajorComplaint(visit)}
                          {visit.course ? ` · ${visit.course}` : ''}
                        </small>
                      </span>
                      <span className="discharge-time">
                        Discharged {formatVisitDate(visit.dischargedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {visits.length === 0 && visitsLoaded && (
          <section className="bottom-grid" style={{ marginTop: '24px' }}>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-label green-text"><Icon name="calendar" /> VISITS LOG</p>
                  <h3>Recent visits</h3>
                </div>
              </div>
              <p className="empty-state" style={{ marginTop: '32px' }}>
                No visits recorded yet. Go to <strong>Patients</strong> to register a patient and record a visit.
              </p>
            </div>

            <div className="panel quick-panel">
              <p className="panel-label yellow-text">QUICK ACTIONS</p>
              <h3>Manage clinic</h3>
              <div className="quick-actions">
                <button onClick={() => handleNavSelect('Patients')}>
                  <Icon name="students" /><span>Find a<br />patient</span>
                </button>
                <button onClick={() => handleNavSelect('Visit history')}>
                  <Icon name="history" /><span>View visit<br />history</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
      {visitToDischarge && (
        <ConfirmDialog
          title="Time out student?"
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
