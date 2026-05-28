import LoginPage from './pages/auth/LoginPage.jsx'
import RegistrationPage from './pages/auth/RegistrationPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'
import AdminDashboard from './pages/admin/Dashboard/AdminDashboard.jsx'
import EmployeeListPage from './pages/admin/Employees/EmployeeListPage.jsx'
import DepartmentListPage from './pages/admin/Departments/DepartmentListPage.jsx'
import LeaveListPage from './pages/admin/Leave/LeaveListPage.jsx'
import AttendanceListPage from './pages/admin/Attendance/AttendanceListPage.jsx'
import MyLeavePage from './pages/me/MyLeavePage.jsx'
import MyAttendancePage from './pages/me/MyAttendancePage.jsx'
import TeamLeavePage from './pages/team/TeamLeavePage.jsx'
import TeamAttendancePage from './pages/team/TeamAttendancePage.jsx'
import { useAuth } from './hooks/useAuth.js'

function App() {
  const { user, loading } = useAuth()
  const currentPath = window.location.pathname.toLowerCase()

  // Public auth routes — always available regardless of session state.
  if (currentPath === '/register' || currentPath === '/signup') {
    return <RegistrationPage />
  }

  if (currentPath === '/forgot-password') {
    return <ForgotPasswordPage />
  }

  if (currentPath === '/reset-password') {
    return <ResetPasswordPage />
  }

  // Employee self-service routes.
  if (currentPath.startsWith('/me/leave')) {
    return <MyLeavePage />
  }

  if (currentPath.startsWith('/me/attendance')) {
    return <MyAttendancePage />
  }

  // Manager routes.
  if (currentPath.startsWith('/team/leave')) {
    return <TeamLeavePage />
  }

  if (currentPath.startsWith('/team/attendance')) {
    return <TeamAttendancePage />
  }

  // Admin shell. AdminLayout itself handles the unauthenticated bounce, so we
  // can render it without a guard here — but we still gate the loading flicker
  // so we don't flash LoginPage before the session resolves. More-specific
  // admin paths must come before the generic /admin catch-all.
  if (currentPath.startsWith('/admin/employees')) {
    return <EmployeeListPage />
  }

  if (currentPath.startsWith('/admin/departments')) {
    return <DepartmentListPage />
  }

  if (currentPath.startsWith('/admin/leave')) {
    return <LeaveListPage />
  }

  if (currentPath.startsWith('/admin/attendance')) {
    return <AttendanceListPage />
  }

  if (currentPath.startsWith('/admin')) {
    return <AdminDashboard />
  }

  // Logged-in default → admin home. Logged-out default → login.
  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white [font-family:'Geist',sans-serif]">
        <p className="text-[0.95rem] text-[#4A5568]">Loading…</p>
      </main>
    )
  }

  return user ? <AdminDashboard /> : <LoginPage />
}

export default App
