import type { AdminRole } from './adminData'

export type AdminScreen =
  | 'dashboard'
  | 'tournaments'
  | 'players'
  | 'recruitment'
  | 'news'
  | 'announcements'
  | 'adminAccess'

const screensByRole: Record<AdminRole, readonly AdminScreen[]> = {
  organizer: ['tournaments', 'players'],
  admin: ['dashboard', 'tournaments', 'players', 'recruitment', 'news', 'announcements'],
  superAdmin: ['dashboard', 'tournaments', 'players', 'recruitment', 'news', 'announcements', 'adminAccess'],
}

export function adminScreensForRole(role: AdminRole) {
  return screensByRole[role]
}

export function canAccessAdminScreen(role: AdminRole, screen: AdminScreen) {
  return adminScreensForRole(role).includes(screen)
}

export function resolveAdminScreen(role: AdminRole, requested: AdminScreen): AdminScreen {
  return canAccessAdminScreen(role, requested) ? requested : adminScreensForRole(role)[0]
}
