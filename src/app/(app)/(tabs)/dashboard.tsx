import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Card } from '@/components/ui/card';
import { Elevation, Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { useDashboardStats } from '@/data/hooks/use-dashboard-stats';
import { useTables } from '@/data/hooks/use-tables';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { ROLE_LABELS } from '@/lib/auth/roles';
import { tapLight, tapMedium } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import { useAuthStore, useCan } from '@/state/auth-store';
import { TAKEAWAY_KEY, useCartStore } from '@/state/cart-store';

interface StatTile {
  key: string;
  label: string;
  value: string;
  hint?: string;
}

interface QuickAction {
  key: string;
  title: string;
  subtitle: string;
  emoji: string;
  enabled: boolean;
  onPress?: () => void;
}

export default function DashboardScreen() {
  const t = usePosTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.session?.user ?? null);
  const signOut = useAuthStore((s) => s.signOut);

  const canManageTables = useCan('manage:tables');
  const canCreateOrder = useCan('create:order');
  const canViewKds = useCan('view:kds');
  const canViewReports = useCan('view:reports');
  const canManageMenu = useCan('manage:menu');

  const { stats, loading: statsLoading } = useDashboardStats();
  const { data: tables } = useTables();
  const cartsByTable = useCartStore((s) => s.cartsByTable);

  const occupiedCount = useMemo(() => {
    let n = 0;
    for (const key of Object.keys(cartsByTable)) {
      if (key === TAKEAWAY_KEY) continue;
      if ((cartsByTable[key]?.length ?? 0) > 0) n += 1;
    }
    return n;
  }, [cartsByTable]);

  const statTiles: StatTile[] = [
    {
      key: 'sales',
      label: "Today's sales",
      value: statsLoading ? '—' : formatMoney(stats.todaySalesCents),
    },
    {
      key: 'orders',
      label: 'Orders today',
      value: statsLoading ? '—' : String(stats.todayOrderCount),
      hint:
        stats.todayOrderCount > 0
          ? `Avg ${formatMoney(stats.todayAverageOrderCents)}`
          : 'No orders yet',
    },
    {
      key: 'tables',
      label: 'Tables',
      value: String(tables.length),
      hint: `${occupiedCount} occupied`,
    },
    {
      key: 'role',
      label: 'Signed in as',
      value: user ? user.name : '—',
      hint: user ? ROLE_LABELS[user.role] : undefined,
    },
  ];

  const goTables = useCallback(() => {
    tapMedium();
    router.push('/tables');
  }, [router]);

  const goTakeaway = useCallback(() => {
    tapMedium();
    router.push('/pos');
  }, [router]);

  const goKds = useCallback(() => {
    tapMedium();
    router.push('/kds');
  }, [router]);

  const goMenu = useCallback(() => {
    tapMedium();
    router.push('/menu');
  }, [router]);

  const goReports = useCallback(() => {
    tapMedium();
    router.push('/reports');
  }, [router]);

  const onSignOut = useCallback(async () => {
    tapLight();
    await signOut();
    router.replace('/login');
  }, [router, signOut]);

  const actions: QuickAction[] = [
    {
      key: 'tables',
      title: 'Open Tables',
      subtitle: 'Pick a table to take an order',
      emoji: '🍽️',
      enabled: canManageTables || canCreateOrder,
      onPress: goTables,
    },
    {
      key: 'takeaway',
      title: 'New Takeaway',
      subtitle: 'Start an order without a table',
      emoji: '🥡',
      enabled: canCreateOrder,
      onPress: goTakeaway,
    },
    {
      key: 'kds',
      title: 'Kitchen Display',
      subtitle: canViewKds ? 'Active tickets in the kitchen' : 'Not available for your role',
      emoji: '👩‍🍳',
      enabled: canViewKds,
      onPress: goKds,
    },
    {
      key: 'menu',
      title: 'Menu',
      subtitle: canManageMenu ? 'Edit categories and products' : 'Owner only',
      emoji: '📋',
      enabled: canManageMenu,
      onPress: goMenu,
    },
    {
      key: 'reports',
      title: 'Reports',
      subtitle: canViewReports ? 'Today’s sales and payments' : 'Not available for your role',
      emoji: '📈',
      enabled: canViewReports,
      onPress: goReports,
    },
    {
      key: 'settings',
      title: 'Settings',
      subtitle: 'Coming soon',
      emoji: '⚙️',
      enabled: false,
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentContainerStyle={styles.scroll}
    >
      <Animated.View entering={FadeInDown.duration(280)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: t.textSecondary }]}>
            {greetingFor(user?.name)}
          </Text>
          <Text style={[styles.headerTitle, { color: t.text }]}>Dashboard</Text>
        </View>
        <AnimatedPressable
          onPress={onSignOut}
          style={[styles.signOutBtn, { borderColor: t.border }]}
        >
          <Text style={[styles.signOutText, { color: t.text }]}>Sign out</Text>
        </AnimatedPressable>
      </Animated.View>

      <View style={styles.statsGrid}>
        {statTiles.map((s, i) => (
          <Animated.View
            key={s.key}
            entering={FadeInRight.delay(60 * i).duration(260)}
            style={styles.statCell}
          >
            <Card style={[styles.statCard, Elevation.card]}>
              <Text style={[styles.statLabel, { color: t.textSecondary }]}>{s.label}</Text>
              <Text style={[styles.statValue, { color: t.text }]} numberOfLines={1}>
                {s.value}
              </Text>
              {s.hint ? (
                <Text style={[styles.statHint, { color: t.textSecondary }]}>{s.hint}</Text>
              ) : null}
            </Card>
          </Animated.View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: t.text }]}>Quick actions</Text>
      <View style={styles.actionsGrid}>
        {actions.map((a, i) => (
          <Animated.View
            key={a.key}
            entering={FadeInDown.delay(40 * i).duration(260)}
            style={styles.actionCell}
          >
            <AnimatedPressable
              onPress={a.enabled ? a.onPress : undefined}
              disabled={!a.enabled}
              style={[
                styles.actionCard,
                {
                  backgroundColor: t.surface,
                  borderColor: t.border,
                  opacity: a.enabled ? 1 : 0.55,
                },
                Elevation.card,
              ]}
            >
              <Text style={styles.actionEmoji}>{a.emoji}</Text>
              <Text style={[styles.actionTitle, { color: t.text }]}>{a.title}</Text>
              <Text style={[styles.actionSubtitle, { color: t.textSecondary }]}>
                {a.subtitle}
              </Text>
              {!a.enabled ? (
                <View style={[styles.soonPill, { backgroundColor: t.surfaceMuted }]}>
                  <Text style={[styles.soonPillText, { color: t.textSecondary }]}>
                    Soon
                  </Text>
                </View>
              ) : null}
            </AnimatedPressable>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

function greetingFor(name?: string | null): string {
  const hour = new Date().getHours();
  const part = greetingPart(hour);
  return name ? `${part}, ${name.split(' ')[0]}` : part;
}

function greetingPart(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1, gap: 2 },
  greeting: { fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  signOutBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signOutText: { fontSize: 14, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.one,
  },
  statCell: {
    width: '50%',
    padding: Spacing.one,
  },
  statCard: {
    padding: Spacing.three,
    gap: Spacing.one,
    minHeight: 100,
    justifyContent: 'center',
  },
  statLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statHint: { fontSize: 12 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: Spacing.two,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.one,
  },
  actionCell: {
    width: '50%',
    padding: Spacing.one,
  },
  actionCard: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
    minHeight: 130,
    position: 'relative',
  },
  actionEmoji: { fontSize: 28 },
  actionTitle: { fontSize: 16, fontWeight: '700' },
  actionSubtitle: { fontSize: 12 },
  soonPill: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  soonPillText: { fontSize: 11, fontWeight: '700' },
});
