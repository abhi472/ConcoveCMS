export const USER_ROLES = ['ADMIN', 'SITE_MANAGER', 'OPERATOR', 'VIEWER'] as const

export type UserRole = typeof USER_ROLES[number]

export function hasRequiredRole(userRole: UserRole, allowed: UserRole[]) {
  return allowed.includes(userRole)
}
