import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { Spacing } from '@/constants/theme';
import { getOrderById, type SubmittedOrder } from '@/data/repos/orders';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { formatMoney } from '@/lib/money';

export default function ReceiptScreen() {
  const t = usePosTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [data, setData] = useState<SubmittedOrder | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!orderId) return;
    void (async () => {
      const result = await getOrderById(db, orderId);
      if (!cancelled) setData(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, orderId]);

  if (!data) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
        <Stack.Screen options={{ title: 'Receipt' }} />
        <View style={styles.center}>
          <Text style={{ color: t.textSecondary }}>Loading receipt…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { order, items, payment } = data;
  const date = new Date(order.created_at);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
      <Stack.Screen options={{ title: `Order #${order.order_number ?? '—'}` }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.springify().damping(16).mass(0.6)}>
          <Card>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 24, fontWeight: '700' }}>CPOS Cafe</Text>
                <Text style={{ color: t.textSecondary, fontSize: 13 }}>{date.toLocaleString()}</Text>
              </View>
              <Pill label={`#${order.order_number ?? '—'}`} tone="brand" />
            </View>

            <View style={[styles.divider, { backgroundColor: t.border }]} />

            <View style={{ gap: 6 }}>
              {items.map((item, i) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInUp.delay(120 + i * 50).springify().damping(18)}
                  style={styles.row}
                >
                  <Text style={{ color: t.text, flex: 1 }}>
                    {item.quantity}× {item.name_snapshot}
                  </Text>
                  <Text style={{ color: t.text, fontWeight: '600' }}>
                    {formatMoney(item.line_subtotal_cents)}
                  </Text>
                </Animated.View>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: t.border }]} />

            <SummaryRow label="Subtotal" value={order.subtotal_cents} />
            {order.discount_cents > 0 ? (
              <SummaryRow label="Discount" value={-order.discount_cents} />
            ) : null}
            {order.tax_cents > 0 ? <SummaryRow label="Tax" value={order.tax_cents} /> : null}
            <SummaryRow label="Total" value={order.grand_total_cents} emphasized />

            <View style={[styles.divider, { backgroundColor: t.border }]} />

            <SummaryRow
              label={`Tendered (${payment.method})`}
              value={payment.tendered_cents ?? payment.amount_cents}
              muted
            />
            <SummaryRow label="Change" value={payment.change_cents ?? 0} muted />

            <View style={styles.footer}>
              <Pill
                label={order.sync_status === 'synced' ? 'Synced to cloud' : 'Saved locally · syncing'}
                tone={order.sync_status === 'synced' ? 'success' : 'warning'}
              />
              <Text
                style={{
                  color: t.textSecondary,
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: Spacing.two,
                }}
              >
                Thank you! Order id: {order.id.slice(0, 8)}…
              </Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(300).springify().damping(18)}
          style={{ gap: Spacing.two }}
        >
          <AppButton
            title="Start new order"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.replace('/tables')}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  emphasized,
  muted,
}: Readonly<{
  label: string;
  value: number;
  emphasized?: boolean;
  muted?: boolean;
}>) {
  const t = usePosTheme();
  return (
    <View style={styles.summaryRow}>
      <Text
        style={{
          color: muted ? t.textSecondary : t.text,
          fontSize: emphasized ? 18 : 14,
          fontWeight: emphasized ? '700' : '500',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: muted ? t.textSecondary : t.text,
          fontSize: emphasized ? 20 : 14,
          fontWeight: emphasized ? '700' : '600',
        }}
      >
        {formatMoney(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: { height: 1, marginVertical: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  footer: {
    marginTop: Spacing.three,
    alignItems: 'center',
  },
});
