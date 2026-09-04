import Icon from './Icon'
import useTheme from '../hooks/useTheme'
import NurseAvatar from './NurseAvatar'

export default function Topbar({
  query,
  onQueryChange,
  onNotification,
  onProfile,
  showSearch = true,
  searchPlaceholder = 'Search patients'
}) {
  const [theme, setTheme] = useTheme()

  // Get current date and time
  const today = new Date()

  // Automatically update the date
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  // Automatically update the greeting
  const hour = today.getHours()

  let greeting

  if (hour < 12) {
    greeting = 'Good morning'
  } else if (hour < 18) {
    greeting = 'Good afternoon'
  } else {
    greeting = 'Good evening'
  }

  return (
    <header className="topbar">
      <div>
        <p className="welcome">{formattedDate}</p>

        <h1>
          {greeting}, Curt Cuvin <span>✦</span>
        </h1>
      </div>

      <div className="top-actions">
        {showSearch && (
          <label className="search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
        )}

        <button
          className="theme-button"
          type="button"
          aria-label={
            theme === 'dark'
              ? 'Switch to light mode'
              : 'Switch to dark mode'
          }
          aria-pressed={theme === 'dark'}
          onClick={() =>
            setTheme((current) =>
              current === 'dark' ? 'light' : 'dark'
            )
          }
        >
          <span aria-hidden="true">
            {theme === 'dark' ? '☀️' : '🌙'}
          </span>
        </button>

        <button
          className="circle-button"
          onClick={() => onNotification('No new notifications.')}
          aria-label="Notifications"
        >
          <Icon name="bell" />
        </button>

        <button
          className="profile-button"
          onClick={() =>
            onProfile('Profile settings are coming soon.')
          }
        >
          <NurseAvatar />
          <i>⌄</i>
        </button>
      </div>
    </header>
  )
}