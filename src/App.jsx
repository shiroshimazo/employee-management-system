import LoginPage from './pages/auth/LoginPage.jsx'
import RegistrationPage from './pages/auth/RegistrationPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'
import AdminDashboard from './pages/admin/Dashboard/AdminDashboard.jsx'
import EmployeeListPage from './pages/admin/Employees/EmployeeListPage.jsx'
import DepartmentListPage from './pages/admin/Departments/DepartmentListPage.jsx'
import LeaveListPage from './pages/admin/Leave/LeaveListPage.jsx'
import AttendanceListPage from './pages/admin/Attendance/AttendanceListPage.jsx'
import UserListPage from './pages/admin/UserManagement/UserListPage.jsx'
import AdminReports from './pages/admin/Reports/AdminReports.jsx'
import MyDashboardPage from './pages/employee/Dashboard/MyDashboardPage.jsx'
import MyAttendancePage from './pages/employee/Attendance/MyAttendancePage.jsx'
import MyLeavePage from './pages/employee/Leave/MyLeavePage.jsx'
import MyPayslipsPage from './pages/employee/Payslips/MyPayslipsPage.jsx'
import MyProfilePage from './pages/employee/Profile/MyProfilePage.jsx'
import TeamLeavePage from './pages/team/TeamLeavePage.jsx'
import TeamAttendancePage from './pages/team/TeamAttendancePage.jsx'
import ForbiddenPage from './pages/errors/ForbiddenPage.jsx'
import { useAuth } from './hooks/useAuth.js'
import { canAccessAdmin, canAccessTeam } from './utils/roleUtils.js'

function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-white [font-family:'Geist',sans-serif]">
      <p className="text-[0.95rem] text-[#4A5568]">Loading…</p>
    </main>
  )
}

function App() {
  const { user, profile, loading } = useAuth()
  const currentPath = window.location.pathname.toLowerCase()
  const role = profile?.role

  // ── Public auth routes ──────────────────────────────────────────────────
  // Always available regardless of session/loading state — these pages don't
  // need a profile, and gating them behind `loading` would stall the reset flow.
  if (currentPath === '/register' || currentPath === '/signup') {
    return <RegistrationPage />
  }
  if (currentPath === '/forgot-password') {
    return <ForgotPasswordPage />
  }
  if (currentPath === '/reset-password') {
    return <ResetPasswordPage />
  }

  // ── Everything below requires authentication ───────────────────────────
  // Wait for the session + profile to resolve before routing. On a fresh page
  // load the auth provider keeps `loading` true until the profile is fetched,
  // so once it's false we can trust `role` — that's what lets us gate by role
  // without flashing a 403 at a privileged user mid-load.
  if (loading) {
    return <LoadingScreen />
  }
  if (!user) {
    return <LoginPage />
  }

  // ── Personal self-service (/employee/*) — every authenticated role ──────
  // More-specific paths first so /employee/attendance doesn't fall through to
  // the dashboard.
  if (currentPath.startsWith('/employee/attendance')) {
    return <MyAttendancePage />
  }
  if (currentPath.startsWith('/employee/leave')) {
    return <MyLeavePage />
  }
  if (currentPath.startsWith('/employee/payslips')) {
    return <MyPayslipsPage />
  }
  if (currentPath.startsWith('/employee/profile')) {
    return <MyProfilePage />
  }
  if (currentPath.startsWith('/employee')) {
    return <MyDashboardPage />
  }

  // ── Team views (/team/*) — managers only ────────────────────────────────
  if (currentPath.startsWith('/team')) {
    if (!canAccessTeam(role)) return <ForbiddenPage />
    if (currentPath.startsWith('/team/attendance')) {
      return <TeamAttendancePage />
    }
    return <TeamLeavePage />
  }

  // ── Admin workspace (/admin/*) — admin + HR only ────────────────────────
  // The single role gate guards the whole tree, including the /admin
  // catch-all, so an employee can't reach any back-office page by URL.
  if (currentPath.startsWith('/admin')) {
    if (!canAccessAdmin(role)) return <ForbiddenPage />
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
    if (currentPath.startsWith('/admin/users')) {
      return <UserListPage />
    }
    if (currentPath.startsWith('/admin/reports')) {
      return <AdminReports />
    }
    return <AdminDashboard />
  }

  // ── Bare / unmatched path → each role's own home ────────────────────────
  // LoginPage sends everyone to '/', so this is where a just-logged-in user
  // lands. Render the highest-privilege home their role actually has instead
  // of defaulting everyone to the admin dashboard. No router here, so we
  // render the home page directly rather than navigating.
  if (canAccessAdmin(role)) return <AdminDashboard />
  if (canAccessTeam(role)) return <TeamLeavePage />
  return <MyDashboardPage />
}

export default App
