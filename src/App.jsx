import { useState } from 'react'
import LoginPage from '../pages/LoginPage.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import ManageStudentsPage from '../pages/ManageStudentsPage.jsx'
import ConcernPage from '../pages/ConcernPage.jsx'
import VisitHistoryPage from '../pages/VisitHistoryPage.jsx'
import NurseProfilePage from '../pages/NurseProfilePage.jsx'
import MedicineInventoryPage from '../pages/MedicineInventoryPage.jsx'

function App() {
  const [signedIn, setSignedIn] = useState(() => {
    return localStorage.getItem('signedIn') === 'true'
  })

  const [page, setPage] = useState(() => {
    return localStorage.getItem('currentPage') || 'Dashboard'
  })

  function handleLogin() {
    localStorage.setItem('signedIn', 'true')
    setSignedIn(true)
  }

  function handleSignOut() {
    localStorage.removeItem('signedIn')
    localStorage.removeItem('currentPage')
    setSignedIn(false)
  }

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
      {page === 'Students' && (
        <ManageStudentsPage onSignOut={handleSignOut} onNavigate={handleNavigate} />
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
