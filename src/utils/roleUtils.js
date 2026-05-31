/**
 * roleUtils — single source of truth for what each role can reach in the UI.
 *
 * The database (RLS in 007_rls_policies.sql) is the real gate on *data*; these
 * helpers gate *navigation* so the two line up — a user never lands on a page
 * whose queries would just come back empty or denied. Roles come from
 * profiles.role: 'admin' | 'hr' | 'manager' | 'payroll' | 'employee'.
 */

// Back-office workspace (/admin/*) — admin and HR, mirroring the Sidebar's
// "Workspace" + "System" sections and the is_admin_or_hr() RLS predicate.
const ADMIN_ROLES = ['admin', 'hr']

export function canAccessAdmin(role) {
  return ADMIN_ROLES.includes(role)
}

// Team views (/team/*) — managers only, mirroring the Sidebar's "Team" section
// and the is_manager() RLS predicate.
export function canAccessTeam(role) {
  return role === 'manager'
}

/**
 * homePathForRole(role) — where a freshly-logged-in user (or one who hits a
 * bare/unknown path) should land: the highest-privilege workspace their role
 * actually has. Unknown/missing role falls back to personal self-service,
 * which every authenticated user can see — a safe least-privilege default.
 */
export function homePathForRole(role) {
  // HR has its own people-ops home; admin keeps the back-office dashboard.
  // (Both can reach each other's areas — this is just where each *lands*.)
  if (role === 'hr') return '/hr'
  if (canAccessAdmin(role)) return '/admin'
  if (canAccessTeam(role)) return '/team/leave'
  return '/employee'
}
