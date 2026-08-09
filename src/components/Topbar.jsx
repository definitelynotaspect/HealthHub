import Icon from './Icon'
import nurseCurt from '../assets/images/nurse-curt.jpg'

export default function Topbar({ query, onQueryChange, onNotification, onProfile, showSearch = true }) {
  return (
    <header className="topbar">
      <div>
        <p className="welcome">Monday, August 10, 2026</p>
        <h1>
          Good morning, Curt Cuvin <span>✦</span>
        </h1>
      </div>
      <div className="top-actions">
        {showSearch && (
          <label className="search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search student"
            />
          </label>
        )}
        <button
          className="circle-button"
          onClick={() => onNotification('No new notifications.')}
          aria-label="Notifications"
        >
          <Icon name="bell" />
        </button>
        <button
          className="profile-button"
          onClick={() => onProfile('Profile settings are coming soon.')}
        >
          <img src={nurseCurt} alt="Nurse Curt Cuvin" />
          <i>⌄</i>
        </button>
      </div>
    </header>
  )
}
