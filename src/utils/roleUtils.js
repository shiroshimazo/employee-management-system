/**
 * roleUtils — single source of truth for what each role can reach in the UI.
 *
 * These helpers gate UI navigation by role. Roles come from profiles.role:
 * 'admin' | 'hr' | 'manager' | 'payroll' | 'employee'.
 */

// System/back-office workspace (/admin/*) — administrators only.
export function canAccessAdmin(role) {
  return role === 'admin'
}

// HR workspace (/hr/*) — HR users only. Admins manage the system, but HR
// routes contain people-ops records that should follow least privilege.
export function canAccessHR(role) {
  return role === 'hr'
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
  if (role === 'hr') return '/hr'
  if (canAccessAdmin(role)) return '/admin'
  if (canAccessTeam(role)) return '/team/leave'
  return '/employee'
}
