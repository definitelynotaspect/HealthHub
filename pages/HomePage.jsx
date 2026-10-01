import { useState } from 'react'
import Icon from '../src/components/Icon.jsx'
import LoginPage from './LoginPage.jsx'
import useTheme from '../src/hooks/useTheme.js'

const features = [
  ['Student health profiles', 'Keep medical details, emergency contacts, and clinic history together for every student.', 'students', '01'],
  ['Daily visit tracking', 'Document consultations, concerns, and care provided before the details are forgotten.', 'history', '02'],
  ['Medicine stock control', 'Review supplies, expiry dates, and medicine movement from one reliable inventory.', 'inventory', '03'],
]

const heroHighlights = [
  'Student records',
  'Clinic visits',
  'Medicine stock',
]

const workflowItems = [
  ['Register', 'Keep student clinic information organized.'],
  ['Record', 'Document consultations and common concerns.'],
  ['Review', 'Check visit history and clinic resources.'],
]

const contactItems = [
  ['Clinic', 'Interworld Colleges Foundation Inc. - School Clinic'],
  ['Hours', 'Monday to Friday, 8:00 AM - 12:00 PM and 1:00 PM - 5:00 PM'],
  ['Access', 'Authorized clinic personnel only'],
]

export default function HomePage({ onLogin, initialLoginOpen = false }) {
  const [loginOpen, setLoginOpen] = useState(initialLoginOpen)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useTheme()

  function handleThemeToggle(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const origin = event.detail
      ? { x: event.clientX, y: event.clientY }
      : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'), origin)
  }

  return (
    <main className="home-page">
      <section className="home-hero">
        <header className="home-nav">
          <div className="home-brand">
            <img src="/icf logo.png?v=transparent" alt="Interworld Colleges Foundation logo" />
            <span>
              <strong>HealthHub</strong>
              <small>School Clinic Portal</small>
            </span>
          </div>
          <button
            className="home-menu-button"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="home-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav id="home-navigation" className={`home-nav-links ${menuOpen ? 'is-open' : ''}`} aria-label="Homepage navigation">
            <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
            <button
              className="theme-button home-theme-button"
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              onClick={handleThemeToggle}
            >
              <span className="theme-toggle-icons">
                <span className={theme === 'light' ? 'selected' : ''}>
                  <Icon name="sun" />
                </span>
                <span className={theme === 'dark' ? 'selected' : ''}>
                  <Icon name="moon" />
                </span>
              </span>
            </button>
            <button className="home-nav-action" type="button" onClick={() => { setMenuOpen(false); setLoginOpen(true) }}>
              Login
            </button>
          </nav>
        </header>

        <div className="home-hero-grid">
          <div className="home-hero-content">
            <p className="home-kicker">Interworld Colleges Foundation Inc.</p>
            <h1>HealthHub</h1>
            <h2>School Clinic Management System</h2>
            <p>
              A clean clinic portal for managing student health records, daily visits,
              health concerns, and medicine inventory in one organized workspace.
            </p>
            <div className="home-hero-actions">
              <button className="home-primary-cta" type="button" onClick={() => setLoginOpen(true)}>
                Access clinic portal <span aria-hidden="true">→</span>
              </button>
              <a className="home-secondary-cta" href="#features">Explore features</a>
            </div>
            <div className="home-hero-tags" aria-label="HealthHub coverage">
              {heroHighlights.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="home-health-visual" aria-hidden="true">
            <div className="home-visual-header">
              <span className="home-cross">+</span>
              <div>
                <strong>Clinic Desk</strong>
                <small>Today's records</small>
              </div>
            </div>
            <div className="home-record-preview">
              <span>
                <b />
                Student profile updated
              </span>
              <span>
                <b />
                Clinic visit recorded
              </span>
              <span>
                <b />
                Medicine stock reviewed
              </span>
            </div>
            <div className="home-visual-row">
              <span><Icon name="students" /></span>
              <span><Icon name="clipboard" /></span>
              <span><Icon name="inventory" /></span>
            </div>
            <p className="home-visual-note"><span /> Information organized for the clinic team</p>
          </div>
        </div>
      </section>

      <section id="about" className="home-section home-about" aria-labelledby="about-title">
        <div>
          <p className="section-kicker">ABOUT HEALTHHUB</p>
          <h2 id="about-title">A simple portal for organized school clinic care.</h2>
        </div>
        <p>
          HealthHub helps the clinic keep student information, consultations, and
          medicine records in one place so daily healthcare services are easier to manage.
        </p>
        <div className="home-workflow" aria-label="HealthHub workflow">
          {workflowItems.map(([title, description]) => (
            <article key={title}>
              <strong>{title}</strong>
              <span>{description}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="home-section home-features-strip" aria-labelledby="features-title">
        <div className="home-features-heading">
          <p className="section-kicker">BUILT FOR THE SCHOOL CLINIC</p>
          <h2 id="features-title">One calm workspace for everyday care.</h2>
          <p>HealthHub brings the essential clinic tasks into a simple, dependable flow.</p>
        </div>
        <div className="home-feature-grid">
          {features.map(([title, description, icon, number]) => (
            <article className="home-feature" key={title}>
              <div className="home-feature-icon"><Icon name={icon} /></div>
              <span className="home-feature-number" aria-hidden="true">{number}</span>
              <div className="home-feature-copy">
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="home-section home-contact" aria-labelledby="contact-title">
        <div>
          <p className="section-kicker">CONTACT</p>
          <h2 id="contact-title">Clinic Information</h2>
        </div>
        <div className="home-contact-list">
          {contactItems.map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <div>
          <strong>HealthHub</strong>
          <span>School Clinic Management System</span>
        </div>
        <span>Interworld Colleges Foundation Inc. © 2026</span>
      </footer>

      {loginOpen && (
        <div className="home-login-modal" role="dialog" aria-modal="true" aria-label="Clinic portal login">
          <button
            className="home-login-backdrop"
            type="button"
            aria-label="Close login"
            onClick={() => setLoginOpen(false)}
          />
          <LoginPage onLogin={onLogin} variant="modal" onClose={() => setLoginOpen(false)} />
        </div>
      )}
    </main>
  )
}
