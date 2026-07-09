import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    CashPanel,
    MethodSelector,
    NonCashPanel,
    buildQuickTenders,
    completePayTitle,
    type PayMethod,
} from '@/components/pos/payment-method-panel';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTables } from '@/data/hooks/use-tables';
import { addPaymentToExistingOrder, listOpenOrdersForTable } from '@/data/repos/orders';
import type { OrderItemRow, OrderRow } from '@/data/schema';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { notifyError, notifySuccess, notifyWarning } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import { requestImmediateDrain } from '@/sync/engine';

interface TicketSnapshot {
  order: OrderRow;
  items: OrderItemRow[];
}

export default function SettleScreen() {
  const t = usePosTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 820;
  const params = useLocalSearchParams<{ orderId: string }>();
  const orderId = params.orderId;

  const [ticket, setTicket] = useState<TicketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const row = await db.getFirstAsync<OrderRow>(
          'SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL',
          [orderId]
        );
        if (!row) {
          if (active) setLoadError('Ticket not found.');
          return;
        }
        const items = await db.getAllAsync<OrderItemRow>(
          'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC',
          [orderId]
        );
        if (active) setTicket({ order: row, items });
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Failed to load ticket');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, orderId]);

  const { data: tables } = useTables();
  const tableName = useMemo(() => {
    const id = ticket?.order.table_id;
    if (!id) return 'Takeaway';
    return tables.find((tbl) => tbl.id === id)?.name ?? 'Table';
  }, [ticket?.order.table_id, tables]);

  const grandTotal = ticket?.order.grand_total_cents ?? 0;

  const [method, setMethod] = useState<PayMethod>('CASH');
  const [tenderedCents, setTenderedCents] = useState(0);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (grandTotal > 0 && tenderedCents === 0) {
      setTenderedCents(grandTotal);
    }
  }, [grandTotal, tenderedCents]);

  const change = Math.max(0, tenderedCents - grandTotal);
  const short = Math.max(0, grandTotal - tenderedCents);

  const wasShortRef = useRef(short > 0);
  useEffect(() => {
    if (method !== 'CASH') return;
    const isShort = short > 0;
    if (wasShortRef.current && !isShort && tenderedCents > 0) {
      notifySuccess();
    } else if (!wasShortRef.current && isShort) {
      notifyWarning();
    }
    wasShortRef.current = isShort;
  }, [short, tenderedCents, method]);

  const quickTenders = useMemo(() => buildQuickTenders(grandTotal), [grandTotal]);

  const submit = useCallback(async () => {
    if (!ticket) return;
    if (method === 'CASH' && tenderedCents < grandTotal) {
      setError('Tendered amount is less than the total.');
      notifyError();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await addPaymentToExistingOrder(db, ticket.order.id, {
        method,
        tenderedCents: method === 'CASH' ? tenderedCents : undefined,
        reference: method === 'CASH' ? null : reference.trim() || null,
      });
      // After a successful settle, also bounce any sibling open tickets for the
      // same table so the banner clears.
      if (ticket.order.table_id) {
        await listOpenOrdersForTable(db, ticket.order.table_id);
      }
      notifySuccess();
      requestImmediateDrain(db);
      router.replace(`/receipt/${result.order.id}`);
    } catch (e) {
      notifyError();
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }, [db, grandTotal, method, reference, router, tenderedCents, ticket]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: t.background }]}>
        <Stack.Screen options={{ title: 'Settle bill' }} />
        <ActivityIndicator color={t.brand} />
      </SafeAreaView>
    );
  }

  if (loadError || !ticket) {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: t.background }]}>
        <Stack.Screen options={{ title: 'Settle bill' }} />
        <Text style={{ color: t.text, fontSize: 16, padding: Spacing.three }}>
          {loadError ?? 'Ticket not found.'}
        </Text>
        <AppButton title="Back" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const completeDisabled =
    submitting || (method === 'CASH' && tenderedCents < grandTotal);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
      <Stack.Screen
        options={{ title: settleTitle(tableName, ticket.order.order_number) }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.body, !isTablet && { flexDirection: 'column' }]}>
          <Card style={styles.col}>
            <Text style={[styles.heading, { color: t.text }]}>
              {orderHeading(ticket.order.order_number)}
            </Text>
            <Text style={{ color: t.textSecondary, marginTop: 2 }}>{tableName}</Text>
            <View style={{ gap: Spacing.two, marginTop: Spacing.three }}>
              {ticket.items.map((item) => (
                <View key={item.id} style={styles.lineRow}>
                  <Text style={{ flex: 1, color: t.text }}>
                    {item.quantity}× {item.name_snapshot}
                  </Text>
                  <Text style={{ color: t.text, fontWeight: '600' }}>
                    {formatMoney(item.unit_price_cents * item.quantity)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            <SummaryRow label="Subtotal" value={ticket.order.subtotal_cents} />
            {ticket.order.tax_cents > 0 ? (
              <SummaryRow label="Tax" value={ticket.order.tax_cents} />
            ) : null}
            <SummaryRow label="Amount due" value={grandTotal} emphasized />
          </Card>

          <Card style={styles.col}>
            <Text style={[styles.heading, { color: t.text }]}>Payment</Text>
            <MethodSelector method={method} onChange={setMethod} />

            {method === 'CASH' ? (
              <CashPanel
                tenderedCents={tenderedCents}
                onChange={setTenderedCents}
                quickTenders={quickTenders}
                short={short}
                change={change}
              />
            ) : (
              <NonCashPanel
                method={method}
                amountCents={grandTotal}
                reference={reference}
                onReferenceChange={setReference}
              />
            )}

            {error ? (
              <Text style={{ color: t.danger, marginTop: Spacing.two }}>{error}</Text>
            ) : null}

            <View style={{ marginTop: Spacing.three, gap: Spacing.two }}>
              <AppButton
                title={completePayTitle(method, submitting)}
                variant="success"
                size="lg"
                loading={submitting}
                disabled={completeDisabled}
                fullWidth
                onPress={submit}
              />
              <AppButton title="Cancel" variant="ghost" fullWidth onPress={() => router.back()} />
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function settleTitle(tableName: string, orderNumber: number | null): string {
  if (orderNumber == null) return `Settle · ${tableName}`;
  return `Settle · ${tableName} · #${orderNumber}`;
}

function orderHeading(orderNumber: number | null): string {
  if (orderNumber == null) return 'Order';
  return `Order #${orderNumber}`;
}

function SummaryRow({
  label,
  value,
  emphasized,
}: Readonly<{ label: string; value: number; emphasized?: boolean }>) {
  const t = usePosTheme();
  return (
    <View style={styles.summaryRow}>
      <Text
        style={{
          color: emphasized ? t.text : t.textSecondary,
          fontSize: emphasized ? 18 : 14,
          fontWeight: emphasized ? '700' : '500',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: t.text,
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
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.three, gap: Spacing.three },
  body: { flexDirection: 'row', gap: Spacing.three },
  col: { flex: 1, minWidth: 280 },
  heading: { fontSize: 18, fontWeight: '700' },
  lineRow: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1, marginVertical: Spacing.three },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
});
