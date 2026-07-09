import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { Elevation, Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { useKitchenOrders } from '@/data/hooks/use-kitchen-orders';
import { useTables } from '@/data/hooks/use-tables';
import type { KitchenOrder } from '@/data/repos/orders';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { notifySuccess, tapMedium } from '@/lib/haptics';
import { useAuthStore, useCan } from '@/state/auth-store';

export default function KdsScreen() {
  const t = usePosTheme();
  const canViewKds = useCan('view:kds');
  const session = useAuthStore((s) => s.session);

  const { data: orders, loading, refresh, mark } = useKitchenOrders(4000);
  const { data: tables } = useTables();
  const tablesById = new Map(tables.map((tbl) => [tbl.id, tbl.name]));
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onReady = useCallback(
    async (orderId: string) => {
      tapMedium();
      await mark(orderId, 'READY');
      notifySuccess();
    },
    [mark]
  );

  const onServed = useCallback(
    async (orderId: string) => {
      tapMedium();
      await mark(orderId, 'SERVED');
      notifySuccess();
    },
    [mark]
  );

  const queueLabel = buildQueueLabel(orders.length);

  if (!canViewKds) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={{ color: t.text, fontSize: 16 }}>
          Your role doesn’t have kitchen access.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>

      <View style={[styles.statusBar, { borderBottomColor: t.border }]}>
        <Text style={[styles.statusText, { color: t.textSecondary }]}>{queueLabel}</Text>
        {session ? (
          <Text style={[styles.statusText, { color: t.textSecondary }]}>
            {session.user.name}
          </Text>
        ) : null}
      </View>

      {orders.length === 0 && !loading ? (
        <EmptyState
          title="All caught up"
          message="No active tickets right now."
          icon="🍳"
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.order.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <KdsTicket
              ticket={item}
              tableName={item.order.table_id ? tablesById.get(item.order.table_id) : null}
              onReady={() => onReady(item.order.id)}
              onServed={() => onServed(item.order.id)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.brand} />
          }
        />
      )}
    </View>
  );
}

interface KdsTicketProps {
  ticket: KitchenOrder;
  tableName: string | null | undefined;
  onReady: () => void;
  onServed: () => void;
}

function KdsTicket({ ticket, tableName, onReady, onServed }: Readonly<KdsTicketProps>) {
  const t = usePosTheme();
  const ageMin = useTicketAgeMin(ticket.order.created_at);
  const isReady = ticket.order.kitchen_status === 'READY';

  return (
    <Animated.View entering={FadeIn} style={styles.ticketWrap}>
      <Card style={[styles.ticket, Elevation.card]}>
        <View style={styles.ticketHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ticketNumber, { color: t.text }]}>
              #{ticket.order.order_number ?? '—'}
            </Text>
            <Text style={[styles.ticketSubtitle, { color: t.textSecondary }]}>
              {tableName ? `Table ${tableName}` : 'Takeaway'}
            </Text>
          </View>
          <View style={styles.ticketBadges}>
            <Pill
              label={isReady ? 'Ready' : 'Cooking'}
              tone={isReady ? 'success' : 'brand'}
            />
            <Text style={[styles.ageText, { color: ageColor(ageMin, t) }]}>{ageMin}m</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: t.border }]} />

        <View style={styles.itemList}>
          {ticket.items.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <Text style={[styles.itemQty, { color: t.brand }]}>{it.quantity}×</Text>
              <Text style={[styles.itemName, { color: t.text }]} numberOfLines={2}>
                {it.name_snapshot}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {isReady ? (
            <AppButton title="Bump (Served)" variant="success" size="md" fullWidth onPress={onServed} />
          ) : (
            <AppButton title="Mark Ready" variant="primary" size="md" fullWidth onPress={onReady} />
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

function useTicketAgeMin(createdAt: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.floor((now - createdAt) / 60_000));
}

function buildQueueLabel(count: number): string {
  if (count === 0) return 'Queue is empty';
  return `${count} open ticket${count === 1 ? '' : 's'}`;
}

function ageColor(min: number, t: ReturnType<typeof usePosTheme>): string {
  if (min >= 15) return t.danger;
  if (min >= 8) return t.warning;
  return t.textSecondary;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  listContent: { padding: Spacing.two, gap: Spacing.two },
  ticketWrap: { padding: Spacing.one },
  ticket: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: Radius.lg,
  },
  ticketHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  ticketNumber: { fontSize: 24, fontWeight: '800' },
  ticketSubtitle: { fontSize: 13, fontWeight: '600' },
  ticketBadges: { alignItems: 'flex-end', gap: 4 },
  ageText: { fontSize: 13, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth },
  itemList: { gap: Spacing.one },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  itemQty: { fontSize: 18, fontWeight: '800', minWidth: 36 },
  itemName: { fontSize: 16, fontWeight: '600', flex: 1 },
  actions: { marginTop: Spacing.two },
  headerBtn: { paddingHorizontal: Spacing.two, paddingVertical: 4 },
});
