import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { usePosTheme } from '@/hooks/use-pos-theme';
import { useCan } from '@/state/auth-store';

interface TabIconProps {
  emoji: string;
  focused: boolean;
}

function TabIcon({ emoji, focused }: Readonly<TabIconProps>) {
  return <Text style={{ fontSize: focused ? 22 : 20 }}>{emoji}</Text>;
}

const homeIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon emoji="🏠" focused={focused} />
);
const tablesIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon emoji="🍽️" focused={focused} />
);
const kdsIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon emoji="👩‍🍳" focused={focused} />
);
const menuIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon emoji="📋" focused={focused} />
);
const reportsIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon emoji="📈" focused={focused} />
);

export default function TabsLayout() {
  const t = usePosTheme();
  const canManageTables = useCan('manage:tables');
  const canCreateOrder = useCan('create:order');
  const canViewKds = useCan('view:kds');
  const canViewReports = useCan('view:reports');
  const canManageMenu = useCan('manage:menu');

  const tablesHref = canManageTables || canCreateOrder ? '/tables' : null;
  const kdsHref = canViewKds ? '/kds' : null;
  const menuHref = canManageMenu ? '/menu' : null;
  const reportsHref = canViewReports ? '/reports' : null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.brand,
        tabBarInactiveTintColor: t.textSecondary,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.border,
        },
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Home', tabBarIcon: homeIcon }}
      />
      <Tabs.Screen
        name="tables"
        options={{ title: 'Tables', href: tablesHref, tabBarIcon: tablesIcon }}
      />
      <Tabs.Screen
        name="kds"
        options={{ title: 'Kitchen', href: kdsHref, tabBarIcon: kdsIcon }}
      />
      <Tabs.Screen
        name="menu"
        options={{ title: 'Menu', href: menuHref, tabBarIcon: menuIcon }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', href: reportsHref, tabBarIcon: reportsIcon }}
      />
    </Tabs>
  );
}
