import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { persistPaidOrder } from '@/data/repos/orders';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { notifyError, notifySuccess, notifyWarning } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import {
    TAKEAWAY_KEY,
    useActiveCartLines,
    useCartStore,
    useCartTotals,
} from '@/state/cart-store';
import { requestImmediateDrain } from '@/sync/engine';

export default function CheckoutScreen() {
  const t = usePosTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 820;
  const params = useLocalSearchParams<{ table?: string }>();
  const tableKey = params.table ?? TAKEAWAY_KEY;
  const isDineIn = tableKey !== TAKEAWAY_KEY;

  const { data: tables } = useTables();
  const tableName = useMemo(() => {
    if (!isDineIn) return 'Takeaway';
    return tables.find((tbl) => tbl.id === tableKey)?.name ?? 'Order';
  }, [isDineIn, tableKey, tables]);

  const setActiveTable = useCartStore((s) => s.setActiveTable);
  useEffect(() => {
    setActiveTable(tableKey);
  }, [tableKey, setActiveTable]);

  const lines = useActiveCartLines();
  const clearTable = useCartStore((s) => s.clearTable);
  const totals = useCartTotals();

  const [method, setMethod] = useState<PayMethod>('CASH');
  const [tenderedCents, setTenderedCents] = useState<number>(totals.grandTotalCents);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = Math.max(0, tenderedCents - totals.grandTotalCents);
  const short = Math.max(0, totals.grandTotalCents - tenderedCents);

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

  const quickTenders = useMemo(
    () => buildQuickTenders(totals.grandTotalCents),
    [totals.grandTotalCents]
  );

  const submit = async () => {
    if (method === 'CASH' && tenderedCents < totals.grandTotalCents) {
      setError('Tendered amount is less than the total.');
      notifyError();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { order } = await persistPaidOrder(
        db,
        lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
        })),
        {
          method,
          tenderedCents: method === 'CASH' ? tenderedCents : undefined,
          reference: method === 'CASH' ? null : reference.trim() || null,
        },
        { tableId: isDineIn ? tableKey : null }
      );
      notifySuccess();
      clearTable(tableKey);
      requestImmediateDrain(db);
      router.replace(`/receipt/${order.id}`);
    } catch (e) {
      notifyError();
      setError(e instanceof Error ? e.message : 'Failed to complete order');
    } finally {
      setSubmitting(false);
    }
  };

  const completeDisabled =
    submitting || (method === 'CASH' && tenderedCents < totals.grandTotalCents);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
      <Stack.Screen options={{ title: `Checkout · ${tableName}` }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.body, !isTablet && { flexDirection: 'column' }]}>
          <Card style={styles.col}>
            <Text style={[styles.heading, { color: t.text }]}>Order summary</Text>
            <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
              {lines.map((l) => (
                <View key={l.lineId} style={styles.lineRow}>
                  <Text style={{ flex: 1, color: t.text }}>
                    {l.quantity}× {l.name}
                  </Text>
                  <Text style={{ color: t.text, fontWeight: '600' }}>
                    {formatMoney(l.unitPriceCents * l.quantity)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            <SummaryRow label="Subtotal" value={totals.subtotalCents} />
            {totals.taxCents > 0 ? <SummaryRow label="Tax" value={totals.taxCents} /> : null}
            <SummaryRow label="Total" value={totals.grandTotalCents} emphasized />
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
                amountCents={totals.grandTotalCents}
                reference={reference}
                onReferenceChange={setReference}
              />
            )}

            {error ? (
              <Text style={{ color: t.danger, marginTop: Spacing.two }}>{error}</Text>
            ) : null}

            <View style={{ marginTop: Spacing.three, gap: Spacing.two }}>
              <AppButton
                title={completeButtonTitle(method, submitting)}
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

function completeButtonTitle(method: PayMethod, submitting: boolean): string {
  if (submitting) return 'Saving…';
  if (method === 'CASH') return 'Complete order';
  return completePayTitle(method, submitting);
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
  scroll: { padding: Spacing.three, gap: Spacing.three },
  body: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  col: {
    flex: 1,
    minWidth: 280,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.three,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
});
