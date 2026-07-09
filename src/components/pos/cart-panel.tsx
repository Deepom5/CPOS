import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, LinearTransition } from 'react-native-reanimated';

import { AnimatedMoney } from '@/components/ui/animated-money';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { AppButton } from '@/components/ui/app-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Stepper } from '@/components/ui/stepper';
import { Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { tapLight } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import {
    type CartLine,
    useActiveCartLines,
    useCartStore,
    useCartTotals,
} from '@/state/cart-store';

export interface CartPanelProps {
  onCharge: () => void;
  tableName?: string;
  /** Extra CTA rendered under the primary Charge button (e.g. Send to Kitchen). */
  extraFooter?: ReactNode;
}

export function CartPanel({ onCharge, tableName, extraFooter }: Readonly<CartPanelProps>) {
  const t = usePosTheme();
  const lines = useActiveCartLines();
  const totals = useCartTotals();
  const clear = useCartStore((s) => s.clear);

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Current order</Text>
          {tableName ? (
            <Text style={{ color: t.textSecondary, fontSize: 12, fontWeight: '600' }}>
              {tableName}
            </Text>
          ) : null}
        </View>
        {lines.length > 0 ? (
          <AnimatedPressable
            onPress={() => {
              tapLight();
              clear();
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear order"
            scaleTo={0.9}
            style={styles.clearBtn}
          >
            <Text style={{ color: t.danger, fontWeight: '600' }}>Clear</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      {lines.length === 0 ? (
        <EmptyState
          title="No items yet"
          message="Tap a product on the left to start a new order."
          icon="🧾"
        />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ gap: Spacing.two }}>
          {lines.map((line) => (
            <Animated.View
              key={line.lineId}
              entering={FadeInRight.springify().damping(18).mass(0.6)}
              exiting={FadeOutLeft.duration(160)}
              layout={LinearTransition.springify().damping(18).mass(0.6)}
            >
              <CartItemRow line={line} />
            </Animated.View>
          ))}
        </ScrollView>
      )}

      <View style={[styles.totals, { borderTopColor: t.border }]}>
        <TotalRow label="Subtotal" amount={totals.subtotalCents} muted />
        {totals.discountCents > 0 ? (
          <TotalRow label="Discount" amount={-totals.discountCents} muted />
        ) : null}
        {totals.taxCents > 0 ? <TotalRow label="Tax" amount={totals.taxCents} muted /> : null}
        <TotalRow label="Total" amount={totals.grandTotalCents} emphasized />
        <AppButton
          title={
            lines.length === 0
              ? 'Add items to charge'
              : `Charge ${formatMoney(totals.grandTotalCents)}`
          }
          variant="primary"
          size="lg"
          fullWidth
          disabled={lines.length === 0}
          onPress={onCharge}
        />
        {extraFooter}
      </View>
    </View>
  );
}

function CartItemRow({ line }: Readonly<{ line: CartLine }>) {
  const t = usePosTheme();
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);
  return (
    <View style={[styles.row, { borderColor: t.border }]}>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontWeight: '600' }}>
          {line.name}
        </Text>
        <Text style={{ color: t.textSecondary, fontSize: 12 }}>
          {formatMoney(line.unitPriceCents)} each
        </Text>
      </View>
      <Stepper
        compact
        value={line.quantity}
        onIncrement={() => increment(line.lineId)}
        onDecrement={() => decrement(line.lineId)}
      />
      <AnimatedMoney
        cents={line.unitPriceCents * line.quantity}
        style={{ color: t.text, fontWeight: '700', minWidth: 64, textAlign: 'right' }}
      />
    </View>
  );
}

function TotalRow({
  label,
  amount,
  muted,
  emphasized,
}: Readonly<{
  label: string;
  amount: number;
  muted?: boolean;
  emphasized?: boolean;
}>) {
  const t = usePosTheme();
  return (
    <View style={styles.totalRow}>
      <Text
        style={{
          color: muted ? t.textSecondary : t.text,
          fontSize: emphasized ? 18 : 14,
          fontWeight: emphasized ? '700' : '500',
        }}
      >
        {label}
      </Text>
      <AnimatedMoney
        cents={amount}
        noBump={muted}
        style={{
          color: muted ? t.textSecondary : t.text,
          fontSize: emphasized ? 20 : 14,
          fontWeight: emphasized ? '700' : '600',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 360,
    borderLeftWidth: 1,
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderBottomWidth: 1,
  },
  clearBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  list: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  totals: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
