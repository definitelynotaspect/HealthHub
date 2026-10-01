import { navItems } from '../data/constants'
import Icon from './Icon'
import NurseAvatar from './NurseAvatar'
import useNurseProfileSummary from '../hooks/useNurseProfileSummary'

export default function Sidebar({ activeNav, onNavSelect, onSignOut, isOpen = false, onClose }) {
  const nurseProfile = useNurseProfileSummary()

  const handleNavSelect = (label) => {
    onNavSelect(label)
    onClose?.()
  }

  const handleSignOut = () => {
    onClose?.()
    onSignOut()
  }

  return (
    <>
      <button
        type="button"
        className={isOpen ? 'sidebar-overlay open' : 'sidebar-overlay'}
        aria-label="Close navigation menu"
        onClick={onClose}
      />

      <aside className={isOpen ? 'sidebar open' : 'sidebar'} aria-label="Main navigation">
        <div className="brand">
          <img src="/icf logo.png?v=transparent" alt="International Colleges Foundation" />
          <div>
            <strong>ICF HealthHub</strong>
            <span>Clinic Management</span>
          </div>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close navigation menu">
            ×
          </button>
        </div>

        <nav aria-label="Main navigation">
          {navItems.map(([label, icon]) => (
            <button
              key={label}
              className={activeNav === label ? 'nav-link active' : 'nav-link'}
              onClick={() => handleNavSelect(label)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className={activeNav === 'Nurse Profile' ? 'staff-profile active' : 'staff-profile'}
            onClick={() => handleNavSelect('Nurse Profile')}
            aria-label="Open nurse profile"
          >
            <NurseAvatar className="staff-avatar" src={nurseProfile.profileImage} alt={nurseProfile.fullName} />
            <span>
              <strong>{nurseProfile.fullName}</strong>
              <small>{nurseProfile.role}</small>
            </span>
          </button>
          <button onClick={handleSignOut} title="Sign out" className="signout">
            Exit
          </button>
        </div>
      </aside>
    </>
  )
}
