import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initDatabase } from '@/data/init';
import { DB_NAME } from '@/lib/constants';
import { useAuthStore } from '@/state/auth-store';
import { startSyncEngine } from '@/sync/engine';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<BootSplash />}>
        <SQLiteProvider databaseName={DB_NAME} onInit={onInit} useSuspense>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AppBootstrap />
            <Stack
              screenOptions={{
                headerTitleStyle: { fontWeight: '700' },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
            </Stack>
          </ThemeProvider>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}

async function onInit(db: SQLiteDatabase) {
  await initDatabase(db);
}

/** One-time effects: kick off auth restore + the local sync engine. */
function AppBootstrap() {
  const db = useSQLiteContext();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  useEffect(() => {
    const stop = startSyncEngine(db);
    return stop;
  }, [db]);
  return null;
}

function BootSplash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
