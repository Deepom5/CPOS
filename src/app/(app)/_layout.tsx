import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/state/auth-store';

export default function AppLayout() {
  const bootstrapping = useAuthStore((s) => s.bootstrapping);
  const session = useAuthStore((s) => s.session);

  if (bootstrapping) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="pos" options={{ title: 'Order' }} />
      <Stack.Screen name="checkout" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settle/[orderId]" options={{ title: 'Settle bill', presentation: 'modal' }} />
      <Stack.Screen name="receipt/[orderId]" options={{ title: 'Receipt' }} />
    </Stack>
  );
}
