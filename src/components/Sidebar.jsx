import { navItems } from '../data/constants'
import Icon from './Icon'
import icfLogo from '../assets/images/ICF_logo.png'
import nurseCurt from '../assets/images/nurse-curt.jpg'

export default function Sidebar({ activeNav, onNavSelect, onSignOut }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src={icfLogo} alt="International Colleges Foundation" />
        <div>
          <strong>ICF HealthHub</strong>
          <span>Clinic Management</span>
        </div>
      </div>

      <nav aria-label="Main navigation">
        {navItems.map(([label, icon]) => (
          <button
            key={label}
            className={activeNav === label ? 'nav-link active' : 'nav-link'}
            onClick={() => onNavSelect(label)}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className={activeNav === 'Nurse Profile' ? 'staff-profile active' : 'staff-profile'}
          onClick={() => onNavSelect('Nurse Profile')}
          aria-label="Open nurse profile"
        >
          <img className="staff-avatar" src={nurseCurt} alt="Nurse Curt Cuvin" />
          <span>
            <strong>Curt Cuvin Gamurot</strong>
            <small>Clinic Nurse</small>
          </span>
        </button>
        <button onClick={onSignOut} title="Sign out" className="signout">
          Exit
        </button>
      </div>
    </aside>
  )
}
