import {
  Building2,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth.js'
import NavItem from './NavItem.jsx'

const PRIMARY_NAV = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Employees', href: '/admin/employees', icon: Users },
  { label: 'Departments', href: '/admin/departments', icon: Building2 },
  { label: 'Reports', href: '/admin/reports', icon: TrendingUp },
]

const SYSTEM_NAV = [
  { label: 'Audit Log', href: '/admin/audit', icon: ScrollText },
  { label: 'Security', href: '/admin/security', icon: ShieldCheck },
  { label: 'Settings', href: '/admin/settings', icon: SettingsIcon },
]

/**
 * Sidebar — fixed-width navigation column for the admin shell.
 *
 * Active route is derived from window.location.pathname. We match by exact
 * string; if a future route is nested (e.g. /admin/employees/123) we'll
 * switch to a startsWith check, but for now exact-match keeps the behaviour
 * predictable.
 */
function Sidebar({ activePath }) {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    window.location.assign('/login')
  }

  const fullName =
    user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Admin'
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
            Admin
          </p>
        </div>
      </div>

      {/* Sections */}
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <div>
          <p className="mb-2 px-3 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            Workspace
          </p>
          <ul className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <NavItem
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  active={activePath === item.href}
                />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 px-3 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#4A5568] [font-family:'Geist_Mono',monospace]">
            System
          </p>
          <ul className="flex flex-col gap-1">
            {SYSTEM_NAV.map((item) => (
              <li key={item.href}>
                <NavItem
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  active={activePath === item.href}
                />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User card + sign out */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#F1F3F5] text-[0.8rem] font-semibold text-[#0F1419]"
            aria-hidden="true"
          >
            {initials || 'A'}
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
