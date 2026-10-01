import { useCallback, useEffect, useRef, useState } from 'react'
import { clinicApi } from '../api/clinicApi'
import Icon from './Icon'
import useTheme from '../hooks/useTheme'
import NurseAvatar from './NurseAvatar'
import useNurseProfileSummary from '../hooks/useNurseProfileSummary'

function getRelativeTime(value) {
  const date = new Date(String(value || '').replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return 'Just now'

  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

function getNotificationTone(type) {
  if (String(type).includes('FAILED') || String(type).includes('OUT_OF_STOCK')) return 'red'
  if (String(type).includes('MEDICINE') || String(type).includes('STOCK')) return 'yellow'
  if (String(type).includes('PARENT_NOTIFICATION_SENT') || String(type).includes('RESTOCKED')) return 'green'
  return 'blue'
}

export default function Topbar({
  query,
  onQueryChange,
  onNotification,
  onProfile,
  onNavigate,
  onMenuClick,
  showSearch = true,
  searchPlaceholder = 'Search patients',
}) {
  const [theme, setTheme] = useTheme()
  const nurseProfile = useNurseProfileSummary()
  const [panelOpen, setPanelOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  function handleThemeToggle(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const origin = event.detail
      ? { x: event.clientX, y: event.clientY }
      : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'), origin)
  }
  const [notificationError, setNotificationError] = useState('')
  const notificationRef = useRef(null)

  const today = new Date()
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const hour = today.getHours()
  let greeting

  if (hour < 12) {
    greeting = 'Good morning'
  } else if (hour < 18) {
    greeting = 'Good afternoon'
  } else {
    greeting = 'Good evening'
  }

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingNotifications(true)
    setNotificationError('')

    try {
      const [listResponse, countResponse] = await Promise.all([
        clinicApi.getNotifications({ limit: 8 }),
        clinicApi.getUnreadNotificationCount(),
      ])
      setNotifications(listResponse.data || [])
      setUnreadCount(Number(countResponse.count || 0))
    } catch (error) {
      setNotificationError(error.message || 'Unable to load notifications.')
    } finally {
      if (!silent) setLoadingNotifications(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadNotifications()
    }, 0)
    const interval = window.setInterval(() => {
      loadNotifications({ silent: true })
    }, 45000)

    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [loadNotifications])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!notificationRef.current?.contains(event.target)) {
        setPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const handleNotificationClick = useCallback(async (notification) => {
    const wasUnread = !notification.isRead
    if (wasUnread) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        )
      )
      setUnreadCount((current) => Math.max(0, current - 1))
    }

    try {
      if (wasUnread) await clinicApi.markNotificationRead(notification.id)

      if (notification.relatedType === 'medicine') {
        onNavigate?.('Medicine Inventory')
        setPanelOpen(false)
      } else if (notification.relatedType === 'visit' || notification.relatedType === 'patient') {
        onNavigate?.('Visit history')
        setPanelOpen(false)
      }
    } catch (error) {
      if (wasUnread) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, isRead: false } : item
          )
        )
        setUnreadCount((current) => current + 1)
      }
      onNotification?.(error.message || 'Unable to mark notification as read.')
    }
  }, [onNavigate, onNotification])

  const handleMarkAllRead = useCallback(async () => {
    const previousNotifications = notifications
    const previousUnreadCount = unreadCount

    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)

    try {
      await clinicApi.markAllNotificationsRead()
    } catch (error) {
      setNotifications(previousNotifications)
      setUnreadCount(previousUnreadCount)
      onNotification?.(error.message || 'Unable to mark notifications as read.')
    }
  }, [notifications, onNotification, unreadCount])

  return (
    <header className="topbar">
      <div className="topbar-title">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Icon name="menu" />
        </button>

        <div className="topbar-copy">
          <p className="welcome">{formattedDate}</p>

          <h1>
            {greeting}, {nurseProfile.fullName} <span>*</span>
          </h1>
        </div>
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

        <div className="notification-menu" ref={notificationRef}>
          <button
            className="circle-button notification-button"
            onClick={() => {
              setPanelOpen((open) => !open)
              if (!panelOpen) loadNotifications()
            }}
            aria-label="Notifications"
            aria-expanded={panelOpen}
          >
            <Icon name="bell" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </button>

          {panelOpen && (
            <div className="notification-panel" role="dialog" aria-label="Notifications">
              <div className="notification-panel-header">
                <strong>Notifications</strong>
                <button
                  type="button"
                  className="notification-link-button"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                >
                  Mark all as read
                </button>
              </div>

              <div className="notification-panel-body">
                {loadingNotifications ? (
                  <p className="notification-status">Loading notifications...</p>
                ) : notificationError ? (
                  <div className="notification-empty">
                    <strong>Unable to load notifications.</strong>
                    <button type="button" className="text-button" onClick={() => loadNotifications()}>
                      Retry
                    </button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <Icon name="bell" />
                    <strong>You're all caught up</strong>
                    <span>There are no new notifications.</span>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      className={notification.isRead ? 'notification-item' : 'notification-item unread'}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <span className={`notification-dot ${getNotificationTone(notification.type)}`} />
                      <span>
                        <strong>{notification.title}</strong>
                        <small>{notification.message}</small>
                        <time>{getRelativeTime(notification.createdAt)}</time>
                      </span>
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                className="notification-view-all"
                onClick={() => {
                  onNavigate?.('Notifications')
                  setPanelOpen(false)
                }}
              >
                View all notifications
              </button>
            </div>
          )}
        </div>

        <button className="profile-button" onClick={() => onProfile?.()} aria-label="Open profile settings">
          <NurseAvatar src={nurseProfile.profileImage} alt={nurseProfile.fullName} />
          <i>⌄</i>
        </button>
      </div>
    </header>
  )
}
