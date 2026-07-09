/**
 * Application roles. Surfaces are gated by these:
 *   owner   – reports, menu mgmt, staff mgmt, tables, orders
 *   waiter  – tables, orders, payments
 *   kitchen – kitchen display only
 */
export type Role = 'owner' | 'waiter' | 'kitchen';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Session {
  user: AuthUser;
  token: string;
  issuedAt: number;
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Restaurant Owner',
  waiter: 'Waiter',
  kitchen: 'Kitchen Staff',
};

/** True when the role is allowed to access the given capability. */
export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export type Capability =
  | 'view:dashboard'
  | 'view:reports'
  | 'manage:menu'
  | 'manage:tables'
  | 'manage:staff'
  | 'create:order'
  | 'view:kds'
  | 'update:order_status';

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  owner: [
    'view:dashboard',
    'view:reports',
    'manage:menu',
    'manage:tables',
    'manage:staff',
    'create:order',
    'view:kds',
    'update:order_status',
  ],
  waiter: ['view:dashboard', 'manage:tables', 'create:order'],
  kitchen: ['view:kds', 'update:order_status'],
};
