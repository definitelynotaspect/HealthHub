import { useEffect, useState } from 'react'
import { AUTH_EXPIRED_EVENT, clearSession, getToken } from './api/clinicApi'
import LoginPage from '../pages/LoginPage.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import ManageStudentsPage from '../pages/ManageStudentsPage.jsx'
import ConcernPage from '../pages/ConcernPage.jsx'
import VisitHistoryPage from '../pages/VisitHistoryPage.jsx'
import NurseProfilePage from '../pages/NurseProfilePage.jsx'
import MedicineInventoryPage from '../pages/MedicineInventoryPage.jsx'
import PersonalDataPage from '../pages/PersonalDataPage.jsx'

function App() {
  const [signedIn, setSignedIn] = useState(() => {
    return Boolean(getToken())
  })

  const [page, setPage] = useState(() => {
    return localStorage.getItem('currentPage') || 'Dashboard'
  })

  function handleLogin() {
    setSignedIn(true)
  }

  function handleSignOut() {
    clearSession()
    localStorage.removeItem('currentPage')
    setSignedIn(false)
  }

  useEffect(() => {
    function handleAuthExpired() {
      localStorage.removeItem('currentPage')
      setSignedIn(false)
      setPage('Dashboard')
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
  }, [])

  function handleNavigate(pageName) {
    setPage(pageName)
    localStorage.setItem('currentPage', pageName)
  }

  if (!signedIn) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <>
      {page === 'Dashboard' && (
        <DashboardPage onSignOut={handleSignOut} onNavigate={handleNavigate} />
      )}
      {page === 'Patients' && (
        <ManageStudentsPage onSignOut={handleSignOut} onNavigate={handleNavigate} />
      )}
      {page === 'Personal Data' && (
        <PersonalDataPage onSignOut={handleSignOut} onNavigate={handleNavigate} />
      )}
      {page === 'Concern Page' && (
        <ConcernPage onSignOut={handleSignOut} onNavigate={handleNavigate} />
      )}
      {page === 'Visit history' && (
        <VisitHistoryPage onSignOut={handleSignOut} onNavigate={handleNavigate} />
      )}
      {page === 'Nurse Profile' && (
        <NurseProfilePage onSignOut={handleSignOut} onNavigate={handleNavigate} />
      )}
      {page === 'Medicine Inventory' && (
        <MedicineInventoryPage onSignOut={handleSignOut} onNavigate={handleNavigate} />
      )}
    </>
  )
}

export default App
