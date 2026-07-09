import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { Elevation, Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { useDailyReport } from '@/data/hooks/use-daily-report';
import type { PaidOrderListItem } from '@/data/repos/reports';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { formatMoney } from '@/lib/money';
import { useCan } from '@/state/auth-store';

export default function ReportsScreen() {
  const t = usePosTheme();
  const canView = useCan('view:reports');
  const { orders, breakdown, loading, refresh } = useDailyReport();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (!canView) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={{ color: t.text, fontSize: 16 }}>
          Your role can’t view reports.
        </Text>
      </View>
    );
  }

  const totalCents = orders.reduce((sum, o) => sum + o.order.grand_total_cents, 0);

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.order.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(260)} style={{ gap: Spacing.three }}>
            <Card style={[styles.summary, Elevation.card]}>
              <Text style={[styles.label, { color: t.textSecondary }]}>Today’s revenue</Text>
              <Text style={[styles.bigNum, { color: t.text }]}>{formatMoney(totalCents)}</Text>
              <Text style={[styles.label, { color: t.textSecondary }]}>
                {orders.length} order{orders.length === 1 ? '' : 's'}
              </Text>
            </Card>

            {breakdown.length > 0 ? (
              <Card style={[styles.breakdown, Elevation.card]}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>By payment method</Text>
                {breakdown.map((b) => (
                  <View key={b.method} style={styles.breakdownRow}>
                    <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
                      <Pill label={b.method} tone={methodTone(b.method)} />
                      <Text style={[styles.dim, { color: t.textSecondary }]}>
                        {b.orderCount} order{b.orderCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Text style={[styles.amount, { color: t.text }]}>
                      {formatMoney(b.totalCents)}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <Text style={[styles.sectionTitle, { color: t.text, paddingHorizontal: Spacing.one }]}>
              Recent orders
            </Text>
          </Animated.View>
        }
        renderItem={({ item }) => <OrderRow item={item} />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="No orders today"
              message="Once you complete an order, it will show up here."
              icon="📊"
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.brand} />
        }
      />
    </View>
  );
}

function methodTone(
  method: PaidOrderListItem['method']
): 'brand' | 'success' | 'warning' | 'neutral' {
  switch (method) {
    case 'CASH':
      return 'success';
    case 'CARD':
      return 'brand';
    case 'UPI':
      return 'warning';
    default:
      return 'neutral';
  }
}

function OrderRow({ item }: Readonly<{ item: PaidOrderListItem }>) {
  const t = usePosTheme();
  const time = new Date(item.order.created_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <View style={styles.orderRowWrap}>
      <Card style={[styles.orderRow, Elevation.card]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.orderNo, { color: t.text }]}>
            #{item.order.order_number ?? '—'}
          </Text>
          <Text style={[styles.dim, { color: t.textSecondary }]}>
            {item.order.channel === 'DINE_IN' ? 'Dine-in' : 'Takeaway'} · {time}
          </Text>
        </View>
        {item.method ? <Pill label={item.method} tone={methodTone(item.method)} /> : null}
        <Text style={[styles.amount, { color: t.text }]}>
          {formatMoney(item.order.grand_total_cents)}
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  list: { padding: Spacing.three, gap: Spacing.two },
  summary: { padding: Spacing.three, gap: 4, borderRadius: Radius.lg },
  breakdown: { padding: Spacing.three, gap: Spacing.two, borderRadius: Radius.lg },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  bigNum: { fontSize: 32, fontWeight: '800' },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amount: { fontSize: 15, fontWeight: '700' },
  dim: { fontSize: 12 },
  orderRowWrap: { paddingVertical: Spacing.one / 2 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radius.md,
    gap: Spacing.two,
  },
  orderNo: { fontSize: 16, fontWeight: '800' },
});
