import { useCallback, useEffect, useMemo, useState } from 'react'
import { clinicApi } from '../src/api/clinicApi'
import { getCachedArray, hasCachedArray, setCachedArray } from '../src/utils/clinicDataCache'
import Sidebar from '../src/components/Sidebar'
import Topbar from '../src/components/Topbar'
import Toast from '../src/components/Toast'
import Icon from '../src/components/Icon'

const filters = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'visits', label: 'Clinic Visits' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'system', label: 'System' },
]

function getNotificationCacheKey(filter, limit) {
  return `notifications:${filter || 'all'}:${limit}`
}

function getGroupLabel(value) {
  const date = new Date(String(value || '').replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return 'Earlier'

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const key = date.toLocaleDateString('en-CA')
  if (key === today.toLocaleDateString('en-CA')) return 'Today'
  if (key === yesterday.toLocaleDateString('en-CA')) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(value) {
  const date = new Date(String(value || '').replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getNotificationTone(type) {
  if (String(type).includes('FAILED') || String(type).includes('OUT_OF_STOCK')) return 'red'
  if (String(type).includes('MEDICINE') || String(type).includes('STOCK')) return 'yellow'
  if (String(type).includes('PARENT_NOTIFICATION_SENT') || String(type).includes('RESTOCKED')) return 'green'
  return 'blue'
}

export default function NotificationsPage({
  onSignOut,
  onNavigate,
  onOpenAccountSettings,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onCloseMobileSidebar,
}) {
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [notifications, setNotifications] = useState(() =>
    getCachedArray(getNotificationCacheKey('', 50))
  )
  const [loading, setLoading] = useState(false)
  const [notificationsLoaded, setNotificationsLoaded] = useState(() =>
    hasCachedArray(getNotificationCacheKey('', 50))
  )
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(50)
  const cacheKey = useMemo(() => getNotificationCacheKey(activeFilter, limit), [activeFilter, limit])

  const loadNotifications = useCallback(async () => {
    const hasCachedNotifications = hasCachedArray(cacheKey)
    if (hasCachedNotifications) {
      setNotifications(getCachedArray(cacheKey))
      setNotificationsLoaded(true)
    }

    setLoading(!hasCachedNotifications)
    setError('')

    try {
      const params = { limit }
      if (activeFilter === 'unread') {
        params.status = 'unread'
      } else if (activeFilter) {
        params.filter = activeFilter
      }

      const { data } = await clinicApi.getNotifications(params)
      setNotifications(setCachedArray(cacheKey, data || []))
      setNotificationsLoaded(true)
    } catch (requestError) {
      setError(requestError.message || 'Unable to load notifications.')
    } finally {
      setLoading(false)
      setNotificationsLoaded(true)
    }
  }, [activeFilter, cacheKey, limit])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadNotifications()
    }, 0)

    return () => window.clearTimeout(initialLoad)
  }, [loadNotifications])

  const filteredNotifications = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notifications

    return notifications.filter((notification) =>
      [notification.title, notification.message, notification.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    )
  }, [notifications, query])

  const groupedNotifications = useMemo(() => {
    const grouped = new Map()

    filteredNotifications.forEach((notification) => {
      const label = getGroupLabel(notification.createdAt)
      const group = grouped.get(label) || []
      group.push(notification)
      grouped.set(label, group)
    })

    return [...grouped.entries()]
  }, [filteredNotifications])

  const handleNavSelect = useCallback((item) => {
    if (item !== 'Notifications') onNavigate(item)
  }, [onNavigate])

  const handleNotificationClick = useCallback(async (notification) => {
    const wasUnread = !notification.isRead
    if (wasUnread) {
      setNotifications((current) => {
        const nextNotifications = current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        )
        setCachedArray(cacheKey, nextNotifications)
        return nextNotifications
      })
    }

    try {
      if (wasUnread) await clinicApi.markNotificationRead(notification.id)

      if (notification.relatedType === 'medicine') {
        onNavigate('Medicine Inventory')
      } else if (notification.relatedType === 'visit' || notification.relatedType === 'patient') {
        onNavigate('Visit history')
      }
    } catch (requestError) {
      if (wasUnread) {
        setNotifications((current) => {
          const nextNotifications = current.map((item) =>
            item.id === notification.id ? { ...item, isRead: false } : item
          )
          setCachedArray(cacheKey, nextNotifications)
          return nextNotifications
        })
      }
      setNotice(requestError.message || 'Unable to mark notification as read.')
    }
  }, [cacheKey, onNavigate])

  const handleMarkAllRead = useCallback(async () => {
    const previous = notifications
    setNotifications((current) => {
      const nextNotifications = current.map((notification) => ({ ...notification, isRead: true }))
      setCachedArray(cacheKey, nextNotifications)
      return nextNotifications
    })

    try {
      await clinicApi.markAllNotificationsRead()
    } catch (requestError) {
      setNotifications(previous)
      setCachedArray(cacheKey, previous)
      setNotice(requestError.message || 'Unable to mark notifications as read.')
    }
  }, [cacheKey, notifications])

  return (
    <div className="app-layout">
      <Sidebar
        activeNav="Notifications"
        onNavSelect={handleNavSelect}
        onSignOut={onSignOut}
        isOpen={mobileSidebarOpen}
        onClose={onCloseMobileSidebar}
      />

      <main className="main-content">
        <Topbar
          query={query}
          onQueryChange={setQuery}
          onNotification={setNotice}
          onProfile={onOpenAccountSettings}
          onNavigate={onNavigate}
          onMenuClick={onOpenMobileSidebar}
          searchPlaceholder="Search notifications"
        />

        <Toast message={notice} onClose={() => setNotice('')} />

        <section className="hero-row">
          <div>
            <p className="section-kicker">NOTIFICATION CENTER</p>
            <h2>Notifications</h2>
            <p>Review clinic alerts, visit updates, and medicine stock activity.</p>
          </div>
          <button className="primary-action" onClick={handleMarkAllRead}>
            <Icon name="bell" /> Mark all as read
          </button>
        </section>

        <div className="history-filters">
          <div className="segmented">
            {filters.map((filter) => (
              <button
                type="button"
                key={filter.value}
                className={activeFilter === filter.value ? 'selected' : ''}
                onClick={() => {
                  setActiveFilter(filter.value)
                  setLimit(50)
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <section className="history-panel panel notification-history-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-label blue-text"><Icon name="bell" /> NOTIFICATIONS</p>
              <h3>
                {notificationsLoaded
                  ? `${filteredNotifications.length} notification${filteredNotifications.length === 1 ? '' : 's'}`
                  : 'Loading notifications...'}
              </h3>
            </div>
          </div>

          {loading && !notificationsLoaded ? (
            <p className="notification-status">Loading notifications...</p>
          ) : error ? (
            <div className="notification-empty">
              <strong>Unable to load notifications.</strong>
              <button type="button" className="text-button" onClick={loadNotifications}>
                Retry
              </button>
            </div>
          ) : groupedNotifications.length === 0 ? (
            <div className="notification-empty page-empty">
              <Icon name="bell" />
              <strong>You're all caught up</strong>
              <span>There are no new notifications.</span>
            </div>
          ) : (
            <div className="notification-timeline">
              {groupedNotifications.map(([group, items]) => (
                <div className="notification-group" key={group}>
                  <h4>{group}</h4>
                  {items.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      className={notification.isRead ? 'notification-row' : 'notification-row unread'}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <time>{formatTime(notification.createdAt)}</time>
                      <span className={`notification-dot ${getNotificationTone(notification.type)}`} />
                      <span>
                        <strong>{notification.title}</strong>
                        <small>{notification.message}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!loading && !error && notifications.length >= limit && (
            <div className="notification-load-more">
              <button type="button" className="text-button" onClick={() => setLimit((current) => current + 50)}>
                Load more
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
