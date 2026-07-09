/**
 * Auth adapter abstraction. The mock adapter performs local credential checks
 * against a hardcoded demo directory; swap to `jwtAdapter` (TBD) once the
 * backend API exists — call sites only depend on this interface.
 */
import type { AuthUser, Role, Session } from './roles';

export interface AuthAdapter {
  signIn: (input: { email: string; password: string }) => Promise<Session>;
  signOut: (session: Session) => Promise<void>;
  /** Re-validate a persisted session on app launch. Returns null if invalid. */
  restore: (token: string) => Promise<Session | null>;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface DemoUser extends AuthUser {
  password: string;
}

const DEMO_USERS: readonly DemoUser[] = [
  {
    id: 'owner-1',
    name: 'Aanya Owner',
    email: 'owner@demo',
    password: 'owner123',
    role: 'owner' as Role,
  },
  {
    id: 'waiter-1',
    name: 'Rohan Waiter',
    email: 'waiter@demo',
    password: 'waiter123',
    role: 'waiter' as Role,
  },
  {
    id: 'kitchen-1',
    name: 'Maya Kitchen',
    email: 'kitchen@demo',
    password: 'kitchen123',
    role: 'kitchen' as Role,
  },
];

function makeMockToken(userId: string): string {
  return `mock.${userId}.${Date.now().toString(36)}`;
}

function userFromToken(token: string): AuthUser | null {
  const parts = token.split('.');
  if (parts.length < 2 || parts[0] !== 'mock') return null;
  const userId = parts[1];
  const user = DEMO_USERS.find((u) => u.id === userId);
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export const mockAuthAdapter: AuthAdapter = {
  signIn: async ({ email, password }) => {
    const trimmedEmail = email.trim().toLowerCase();
    const match = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === trimmedEmail && u.password === password
    );
    if (!match) {
      throw new AuthError('Incorrect email or password.');
    }
    return {
      user: { id: match.id, name: match.name, email: match.email, role: match.role },
      token: makeMockToken(match.id),
      issuedAt: Date.now(),
    };
  },
  signOut: async () => {
    // No remote state to invalidate yet.
  },
  restore: async (token) => {
    const user = userFromToken(token);
    if (!user) return null;
    return { user, token, issuedAt: Date.now() };
  },
};

/** Demo credentials shown on the login screen as a hint. */
export const DEMO_CREDENTIALS: readonly {
  role: Role;
  email: string;
  password: string;
}[] = DEMO_USERS.map((u) => ({ role: u.role, email: u.email, password: u.password }));
