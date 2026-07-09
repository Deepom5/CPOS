import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { AuthError, mockAuthAdapter, type AuthAdapter } from '@/lib/auth/api';
import type { Capability, Role, Session } from '@/lib/auth/roles';
import { can } from '@/lib/auth/roles';

const TOKEN_KEY = 'cpos.auth.token';

interface AuthState {
  session: Session | null;
  /** True while we're checking SecureStore for a persisted token at startup. */
  bootstrapping: boolean;
  /** True while a sign-in request is in flight. */
  signingIn: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

const adapter: AuthAdapter = mockAuthAdapter;

async function safeSetToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Persistence failure is non-fatal — session remains in memory.
  }
}

async function safeClearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Ignore.
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  bootstrapping: true,
  signingIn: false,
  error: null,
  bootstrap: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        set({ bootstrapping: false });
        return;
      }
      const session = await adapter.restore(token);
      if (session) {
        set({ session, bootstrapping: false });
      } else {
        await safeClearToken();
        set({ bootstrapping: false });
      }
    } catch {
      set({ bootstrapping: false });
    }
  },
  signIn: async (email, password) => {
    set({ signingIn: true, error: null });
    try {
      const session = await adapter.signIn({ email, password });
      await safeSetToken(session.token);
      set({ session, signingIn: false });
    } catch (e) {
      const message = errorMessage(e);
      set({ signingIn: false, error: message });
      throw e;
    }
  },
  signOut: async () => {
    const current = useAuthStore.getState().session;
    if (current) await adapter.signOut(current).catch(() => {});
    await safeClearToken();
    set({ session: null });
  },
}));

export function useSession(): Session | null {
  return useAuthStore((s) => s.session);
}

export function useCurrentRole(): Role | null {
  return useAuthStore((s) => s.session?.user.role ?? null);
}

export function useCan(capability: Capability): boolean {
  const role = useCurrentRole();
  if (!role) return false;
  return can(role, capability);
}

function errorMessage(e: unknown): string {
  if (e instanceof AuthError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Sign-in failed';
}
