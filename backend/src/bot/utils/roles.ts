/**
 * Role Hierarchy Utilities
 *
 * Provides role-level comparison for RBAC:
 * admin > manager > accountant > observer
 *
 * @module bot/utils/roles
 */

export type UserRole = 'observer' | 'accountant' | 'manager' | 'admin';

const ROLE_LEVEL: Record<string, number> = {
  observer: 0,
  accountant: 1,
  manager: 2,
  admin: 3,
};

/**
 * Check if a user's role meets the minimum required level.
 *
 * @param userRole - The user's current role
 * @param minRole - The minimum role required
 * @returns true if userRole >= minRole in the hierarchy
 */
export function hasMinRole(userRole: string, minRole: UserRole): boolean {
  return (ROLE_LEVEL[userRole] ?? -1) >= (ROLE_LEVEL[minRole] ?? Infinity);
}
