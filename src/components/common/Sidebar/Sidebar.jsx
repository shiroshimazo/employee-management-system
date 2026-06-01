import {
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  FileText,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  TrendingUp,
  UserCircle,
  UserCog,
  UserSearch,
  Users,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth.js'
import NavItem from './NavItem.jsx'

/**
 * Sidebar — role-aware primary navigation.
 *
 * Sections (and the roles that see them):
 *   - Workspace : admin · hr      → /admin/* CRUD pages
 *   - Team      : manager         → /team/*  read-mostly views
 *   - Personal  : everyone        → /me/*    self-service
 *   - System    : admin · hr      → audit / security / settings
 *
 * The role check mirrors the RLS policies in 007_rls_policies.sql, so what
 * the sidebar shows lines up with what the database will actually let the
 * caller do. Hiding a link doesn't gate access (the route still resolves);
 * the database is the source of truth — this is just navigation hygiene.
 *
 * Active match:
 *   Dashboard uses exact match (/admin), everything else uses prefix so a
 *   nested route like /admin/employees/123 still highlights Employees.
 */

const SECTIONS = [
  {
    title: 'Workspace',
    // Admin-only back-office. HR has its own People module instead of these
    // admin management pages.
    roles: ['admin'],
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'Employees', href: '/admin/employees', icon: Users },
      { label: 'Departments', href: '/admin/departments', icon: Building2 },
      { label: 'Leave', href: '/admin/leave', icon: CalendarCheck },
      { label: 'Attendance', href: '/admin/attendance', icon: CalendarDays },
      { label: 'Reports', href: '/admin/reports', icon: TrendingUp },
    ],
  },
  {
    title: 'Team',
    roles: ['manager'],
    items: [
      { label: 'Team Leave', href: '/team/leave', icon: CalendarCheck },
      { label: 'Team Attendance', href: '/team/attendance', icon: CalendarDays },
    ],
  },
  {
    title: 'People',
    // HR's own module — admin can reach it too. Sits alongside Workspace
    // rather than replacing it: HR still manages records via the admin pages,
    // this adds the directory + 360 record view.
    roles: ['admin', 'hr'],
    items: [
      { label: 'HR Dashboard', href: '/hr', icon: LayoutDashboard, exact: true },
      { label: 'Directory', href: '/hr/directory', icon: Users },
      { label: 'Documents', href: '/hr/documents', icon: FileText },
      { label: 'Leave Requests', href: '/hr/leave', icon: CalendarCheck, exact: true },
      { label: 'Holidays', href: '/hr/holidays', icon: CalendarDays },
      { label: 'Leave Policy', href: '/hr/leave-policy', icon: ScrollText },
      { label: 'Job Postings', href: '/hr/jobs', icon: Briefcase },
      { label: 'Applicants', href: '/hr/applicants', icon: UserSearch },
    ],
  },
  {
    title: 'Personal',
    // HR / managers / payroll / employees see their own self-service — they're
    // staff too. Admin is treated as a pure back-office role here, so it's
    // intentionally excluded: an admin manages the system, not their own
    // timesheet.
    roles: ['hr', 'manager', 'payroll', 'employee'],
    items: [
      { label: 'My Dashboard', href: '/employee', icon: LayoutDashboard, exact: true },
      { label: 'My Attendance', href: '/employee/attendance', icon: CalendarDays },
      { label: 'My Leave', href: '/employee/leave', icon: CalendarCheck },
      { label: 'My Payslips', href: '/employee/payslips', icon: FileText },
      { label: 'My Profile', href: '/employee/profile', icon: UserCircle },
    ],
  },
  {
    title: 'System',
    roles: ['admin', 'hr'],
    items: [
      // Users is admin-only — changing roles is gated to admin by RLS, so HR
      // shouldn't see a link that would just fail at the database.
      { label: 'Users', href: '/admin/users', icon: UserCog, roles: ['admin'] },
      { label: 'Audit Log', href: '/admin/audit', icon: ScrollText },
      { label: 'Security', href: '/admin/security', icon: ShieldCheck },
      // Settings writes are admin-only by RLS (org_settings_update_admin uses
      // is_admin()), so HR would only hit a save error — admin-only like Users.
      { label: 'Settings', href: '/admin/settings', icon: SettingsIcon, roles: ['admin'] },
    ],
  },
]

// Friendly label for the brand sub-line based on role.
const ROLE_LABEL = {
  admin: 'Admin',
  hr: 'HR',
  manager: 'Manager',
  payroll: 'Payroll',
  employee: 'Personal',
}

function isItemActive(currentPath, item) {
  if (item.exact) return currentPath === item.href
  return currentPath === item.href || currentPath.startsWith(`${item.href}/`)
}

function Sidebar({ activePath }) {
  const { user, profile, signOut } = useAuth()

  // Default to 'employee' if profile/role hasn't loaded yet — that gives a
  // signed-in user something to navigate to instead of an empty sidebar
  // while the profile request is in flight.
  const role = profile?.role ?? 'employee'

  const visibleSections = SECTIONS.filter((s) => s.roles.includes(role))

  // An item may narrow its section's roles further (e.g. Users is admin-only
  // inside an admin+hr section). Default to the section's audience when an
  // item doesn't specify its own.
  const itemVisible = (item) => !item.roles || item.roles.includes(role)

  const handleSignOut = async () => {
    await signOut()
    window.location.assign('/login')
  }

  const fullName =
    user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User'
  const initials = fullName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside
      aria-label="Primary"
      className="sticky top-0 flex h-dvh w-[260px] flex-none flex-col border-r border-slate-200 bg-white px-4 py-6"
    >
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#2C5EF5] text-[0.85rem] font-bold text-white [font-family:'Geist_Mono',monospace]"
          aria-hidden="true"
        >
          EMS
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[0.95rem] font-semibold leading-tight text-[#0F1419]">
            Employee Hub
          </p>
          <p className="m-0 text-[0.7rem] uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            {ROLE_LABEL[role] ?? 'Personal'}
          </p>
        </div>
      </div>

      {/* Sections */}
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
              {section.title}
            </p>
            <ul className="flex flex-col gap-1">
              {section.items.filter(itemVisible).map((item) => (
                <li key={item.href}>
                  <NavItem
                    icon={item.icon}
                    label={item.label}
                    href={item.href}
                    active={isItemActive(activePath, item)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card + sign out */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#F1F3F5] text-[0.8rem] font-semibold text-[#0F1419]"
            aria-hidden="true"
          >
            {initials || 'U'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[0.85rem] font-semibold leading-tight text-[#0F1419]">
              {fullName}
            </p>
            <p className="m-0 truncate text-[0.7rem] leading-tight text-[#4A5568]">
              {user?.email ?? '—'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-0 bg-transparent px-3 py-2.5 text-[0.95rem] font-medium leading-tight text-[#4A5568] transition-[background-color,color] duration-150 hover:bg-[#F1F3F5] hover:text-[#0F1419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C5EF5]"
        >
          <LogOut size={18} strokeWidth={2} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
