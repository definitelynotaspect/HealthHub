import { useEffect, useRef, useState } from 'react'
import {
  API_REQUEST_FINISHED_EVENT,
  API_REQUEST_STARTED_EVENT,
  AUTH_EXPIRED_EVENT,
  clearSession,
  getToken,
} from './api/clinicApi'
import HomePage from '../pages/HomePage.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import ManageStudentsPage from '../pages/ManageStudentsPage.jsx'
import ConcernPage from '../pages/ConcernPage.jsx'
import VisitHistoryPage from '../pages/VisitHistoryPage.jsx'
import NurseProfilePage from '../pages/NurseProfilePage.jsx'
import MedicineInventoryPage from '../pages/MedicineInventoryPage.jsx'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import PersonalDataPage from '../pages/PersonalDataPage.jsx'
import ResetPasswordPage from '../pages/ResetPasswordPage.jsx'
import AccountSettingsModal from './components/AccountSettingsModal.jsx'
import LoadingOverlay from './components/LoadingOverlay.jsx'
import BackToTopButton from './components/BackToTopButton.jsx'

function App() {
  const resetToken = new URLSearchParams(window.location.search).get('resetToken')
  const [signedIn, setSignedIn] = useState(() => {
    return Boolean(getToken())
  })

  const [authView, setAuthView] = useState('home')
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const [page, setPage] = useState(() => {
    return sessionStorage.getItem('currentPage') || 'Dashboard'
  })
  const [pageLoading, setPageLoading] = useState(false)
  const [startupLoading, setStartupLoading] = useState(true)
  const [activeRequests, setActiveRequests] = useState(0)
  const [showGlobalLoading, setShowGlobalLoading] = useState(false)
  const navigationTimerRef = useRef(null)

  function handleLogin() {
    setSignedIn(true)
  }

  function handleSignOut() {
    clearSession()
    sessionStorage.removeItem('currentPage')
    setAccountSettingsOpen(false)
    setMobileSidebarOpen(false)
    setSignedIn(false)
    setAuthView('home')
  }

  useEffect(() => {
    function handleAuthExpired() {
      sessionStorage.removeItem('currentPage')
      setAccountSettingsOpen(false)
      setMobileSidebarOpen(false)
      setSignedIn(false)
      setAuthView('login')
      setPage('Dashboard')
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
  }, [])

  function handleNavigate(pageName) {
    sessionStorage.setItem('currentPage', pageName)
    setMobileSidebarOpen(false)
    if (pageName === page) return

    window.clearTimeout(navigationTimerRef.current)
    setPageLoading(true)
    navigationTimerRef.current = window.setTimeout(() => {
      setPage(pageName)
      setPageLoading(false)
    }, 220)
  }

  useEffect(() => {
    return () => window.clearTimeout(navigationTimerRef.current)
  }, [])

  useEffect(() => {
    const startupTimer = window.setTimeout(() => setStartupLoading(false), 450)
    return () => window.clearTimeout(startupTimer)
  }, [])

  useEffect(() => {
    function handleRequestStarted() {
      setActiveRequests((count) => count + 1)
    }

    function handleRequestFinished() {
      setActiveRequests((count) => Math.max(0, count - 1))
    }

    window.addEventListener(API_REQUEST_STARTED_EVENT, handleRequestStarted)
    window.addEventListener(API_REQUEST_FINISHED_EVENT, handleRequestFinished)
    return () => {
      window.removeEventListener(API_REQUEST_STARTED_EVENT, handleRequestStarted)
      window.removeEventListener(API_REQUEST_FINISHED_EVENT, handleRequestFinished)
    }
  }, [])

  useEffect(() => {
    if (activeRequests === 0) {
      setShowGlobalLoading(false)
      return undefined
    }

    const timer = window.setTimeout(() => setShowGlobalLoading(true), 120)
    return () => window.clearTimeout(timer)
  }, [activeRequests])

  useEffect(() => {
    document.body.classList.toggle('sidebar-drawer-open', mobileSidebarOpen)
    return () => document.body.classList.remove('sidebar-drawer-open')
  }, [mobileSidebarOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleDesktopViewport = (event) => {
      if (event.matches) setMobileSidebarOpen(false)
    }

    mediaQuery.addEventListener('change', handleDesktopViewport)
    return () => mediaQuery.removeEventListener('change', handleDesktopViewport)
  }, [])

  if (!signedIn && resetToken) {
    return <ResetPasswordPage token={resetToken} onComplete={() => setAuthView('login')} />
  }

  if (!signedIn) {
    return (
      <>
        {startupLoading && <LoadingOverlay message="Starting application..." />}
        {!startupLoading && showGlobalLoading && <LoadingOverlay message="Loading..." blocking={false} />}
        {authView === 'login'
          ? <HomePage onLogin={handleLogin} initialLoginOpen />
          : <HomePage onLogin={handleLogin} />}
      </>
    )
  }

  return (
    <>
      {startupLoading && <LoadingOverlay message="Starting application..." />}
      {!startupLoading && showGlobalLoading && <LoadingOverlay message="Loading..." blocking={false} />}
      {pageLoading && <LoadingOverlay message="Loading page..." blocking={false} />}
      <BackToTopButton />
      {page === 'Dashboard' && (
        <DashboardPage
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'Patients' && (
        <ManageStudentsPage
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'Personal Data' && (
        <PersonalDataPage
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'Concern Page' && (
        <ConcernPage
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'Visit history' && (
        <VisitHistoryPage
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'Nurse Profile' && (
        <NurseProfilePage
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'Medicine Inventory' && (
        <MedicineInventoryPage
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'Notifications' && (
        <NotificationsPage
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
          onOpenAccountSettings={() => setAccountSettingsOpen(true)}
          mobileSidebarOpen={mobileSidebarOpen}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        />
      )}
      {accountSettingsOpen && (
        <AccountSettingsModal
          onClose={() => setAccountSettingsOpen(false)}
          onRequireLogin={handleSignOut}
        />
      )}
    </>
  )
}

export default App
