import { useMemo, useState, useCallback } from 'react'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'
import nurseCurt from '../src/assets/images/nurse-curt.jpg'

function readStoredList(key) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

export default function NurseProfilePage({ onSignOut, onNavigate }) {
  const [activeNav, setActiveNav] = useState('Nurse Profile')
  const [notice, setNotice] = useState('')

  const stats = useMemo(() => {
    const visits = readStoredList('visits')
    const students = readStoredList('students')

    return {
      students: students.length,
      visits: visits.length,
      active: visits.filter((visit) => !visit.dischargedAt).length,
      discharged: visits.filter((visit) => visit.dischargedAt).length,
    }
  }, [])

  const handleNavSelect = useCallback(
    (item) => {
      setActiveNav(item)
      if (item !== 'Nurse Profile') onNavigate(item)
    },
    [onNavigate]
  )

  return (
    <div className="app-layout">
      <Sidebar activeNav={activeNav} onNavSelect={handleNavSelect} onSignOut={onSignOut} />

      <main className="main-content">
        <Topbar
          query=""
          onQueryChange={() => {}}
          onNotification={setNotice}
          onProfile={() => setNotice('You are already viewing the nurse profile.')}
          showSearch={false}
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">NURSE PROFILE</p>
            <h2>Curt Cuvin Gamurot</h2>
            <p>Mockup profile page for the clinic nurse account.</p>
          </div>
          <button className="primary-action" onClick={() => handleNavSelect('Dashboard')}>
            <Icon name="grid" /> Back to dashboard
          </button>
        </section>

        <section className="nurse-profile-grid">
          <div className="panel nurse-profile-card">
            <img src={nurseCurt} alt="Nurse Curt Cuvin" />
            <span className="status-pill done">On duty</span>
            <h3>Curt Cuvin Gamurot</h3>
            <p>Clinic Nurse</p>
            <div className="nurse-contact-list">
              <span><Icon name="clipboard" /> Employee ID: 2026-0630</span>
              <span><Icon name="calendar" /> Shift: 8:00 AM - 5:00 PM</span>
              <span><Icon name="heart" /> School Clinic Department</span>
            </div>
          </div>

          <div className="nurse-profile-main">
            <section className="stats-grid nurse-stats" aria-label="Nurse profile statistics">
              <div className="stat-card blue">
                <span className="stat-icon"><Icon name="students" /></span>
                <div>
                  <strong>{stats.students}</strong>
                  <p>Students handled</p>
                  <small>Registered student records</small>
                </div>
              </div>
              <div className="stat-card red">
                <span className="stat-icon"><Icon name="clipboard" /></span>
                <div>
                  <strong>{stats.visits}</strong>
                  <p>Total visits</p>
                  <small>Clinic visit records</small>
                </div>
              </div>
              <div className="stat-card yellow">
                <span className="stat-icon"><Icon name="calendar" /></span>
                <div>
                  <strong>{stats.active}</strong>
                  <p>Active cases</p>
                  <small>Currently in clinic</small>
                </div>
              </div>
              <div className="stat-card green">
                <span className="stat-icon"><Icon name="heart" /></span>
                <div>
                  <strong>{stats.discharged}</strong>
                  <p>Timed out</p>
                  <small>Completed visits</small>
                </div>
              </div>
            </section>

            <section className="panel nurse-info-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-label blue-text"><Icon name="clipboard" /> PROFILE DETAILS</p>
                  <h3>Nurse information</h3>
                </div>
              </div>

              <div className="nurse-detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Full name</span>
                  <span className="detail-value">Curt Cuvin Gamurot</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Role</span>
                  <span className="detail-value">Clinic Nurse</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">curtcuvingamurot0@gmail.com</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Contact</span>
                  <span className="detail-value">0951 058 9402</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Assigned room</span>
                  <span className="detail-value">Main Clinic Room</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">License</span>
                  <span className="detail-value">RN-1087510</span>
                </div>
              </div>
            </section>

            <section className="panel nurse-info-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-label green-text"><Icon name="heart" /> RESPONSIBILITIES</p>
                  <h3>Clinic duties</h3>
                </div>
              </div>
              <div className="nurse-duty-list">
                <span>Record student clinic visits and common concerns.</span>
                <span>Monitor active cases until students are timed out.</span>
                <span>Maintain accurate student health visit history.</span>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}
