import { Redirect, Stack } from 'expo-router';

import { landingFor } from '@/lib/auth/landing';
import { useAuthStore } from '@/state/auth-store';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  // Already signed in → bounce out of the auth flow.
  if (session) return <Redirect href={landingFor(session.user.role)} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
