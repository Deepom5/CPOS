import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { landingFor } from '@/lib/auth/landing';
import { useAuthStore } from '@/state/auth-store';

/**
 * Root entry. Waits for auth bootstrap then routes to either the auth flow or
 * the in-app flow based on whether we have a restored session.
 */
export default function RootIndex() {
  const bootstrapping = useAuthStore((s) => s.bootstrapping);
  const session = useAuthStore((s) => s.session);

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (session) return <Redirect href={landingFor(session.user.role)} />;
  return <Redirect href="/login" />;
}
