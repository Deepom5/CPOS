import type { Role } from '@/lib/auth/roles';

/**
 * Default landing path after sign-in or app boot, picked per role so each user
 * type lands on their primary surface.
 */
export function landingFor(role: Role): '/dashboard' | '/kds' {
  if (role === 'kitchen') return '/kds';
  return '/dashboard';
}
