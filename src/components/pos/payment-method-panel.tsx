import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AnimatedMoney } from '@/components/ui/animated-money';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { AppButton } from '@/components/ui/app-button';
import { NumberPad } from '@/components/ui/number-pad';
import { Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import type { PaymentMethod } from '@/data/schema';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { formatMoney } from '@/lib/money';

export type PayMethod = Extract<PaymentMethod, 'CASH' | 'CARD' | 'UPI'>;

export const PAYMENT_METHODS: { id: PayMethod; label: string; emoji: string }[] = [
  { id: 'CASH', label: 'Cash', emoji: '💵' },
  { id: 'CARD', label: 'Card', emoji: '💳' },
  { id: 'UPI', label: 'UPI', emoji: '📱' },
];

interface MethodPillProps {
  label: string;
  emoji: string;
  active: boolean;
  onPress: () => void;
}

export function MethodPill({ label, emoji, active, onPress }: Readonly<MethodPillProps>) {
  const t = usePosTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        styles.methodPill,
        {
          backgroundColor: active ? t.brand : t.surfaceMuted,
          borderColor: active ? t.brand : t.border,
        },
      ]}
    >
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={{ color: active ? t.brandText : t.text, fontWeight: '700' }}>{label}</Text>
    </AnimatedPressable>
  );
}

interface MethodSelectorProps {
  method: PayMethod;
  onChange: (m: PayMethod) => void;
}

export function MethodSelector({ method, onChange }: Readonly<MethodSelectorProps>) {
  return (
    <View style={styles.methodRow}>
      {PAYMENT_METHODS.map((m) => (
        <MethodPill
          key={m.id}
          label={m.label}
          emoji={m.emoji}
          active={method === m.id}
          onPress={() => onChange(m.id)}
        />
      ))}
    </View>
  );
}

interface CashPanelProps {
  tenderedCents: number;
  onChange: (cents: number) => void;
  quickTenders: number[];
  short: number;
  change: number;
}

export function CashPanel({
  tenderedCents,
  onChange,
  quickTenders,
  short,
  change,
}: Readonly<CashPanelProps>) {
  const t = usePosTheme();
  return (
    <>
      <View style={{ marginTop: Spacing.three, gap: Spacing.two }}>
        <Text style={{ color: t.textSecondary, fontSize: 13 }}>Tendered</Text>
        <AnimatedMoney
          cents={tenderedCents}
          style={{ color: t.text, fontSize: 36, fontWeight: '700', textAlign: 'left' }}
        />
        {short > 0 ? (
          <Text style={{ color: t.danger, fontWeight: '600' }}>
            Short by {formatMoney(short)}
          </Text>
        ) : (
          <Text style={{ color: t.success, fontWeight: '600' }}>
            Change due {formatMoney(change)}
          </Text>
        )}
      </View>

      <View style={styles.quickRow}>
        {quickTenders.map((v) => (
          <AppButton
            key={v}
            size="sm"
            variant="secondary"
            title={formatMoney(v)}
            haptic="light"
            onPress={() => onChange(v)}
          />
        ))}
        <AppButton
          size="sm"
          variant="ghost"
          title="Clear"
          haptic="light"
          onPress={() => onChange(0)}
        />
      </View>

      <View style={{ marginTop: Spacing.three }}>
        <NumberPad valueCents={tenderedCents} onChange={onChange} />
      </View>
    </>
  );
}

interface NonCashPanelProps {
  method: PayMethod;
  amountCents: number;
  reference: string;
  onReferenceChange: (next: string) => void;
}

export function NonCashPanel({
  method,
  amountCents,
  reference,
  onReferenceChange,
}: Readonly<NonCashPanelProps>) {
  const t = usePosTheme();
  const placeholder = method === 'CARD' ? 'Auth code / last 4 digits' : 'UPI reference / VPA';
  return (
    <View style={{ marginTop: Spacing.three, gap: Spacing.two }}>
      <Text style={{ color: t.textSecondary, fontSize: 13 }}>Amount due</Text>
      <Text style={{ color: t.text, fontSize: 36, fontWeight: '700' }}>
        {formatMoney(amountCents)}
      </Text>
      <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: Spacing.two }}>
        Reference (optional)
      </Text>
      <TextInput
        value={reference}
        onChangeText={onReferenceChange}
        placeholder={placeholder}
        placeholderTextColor={t.textSecondary}
        autoCapitalize="characters"
        style={[
          styles.refInput,
          { color: t.text, borderColor: t.border, backgroundColor: t.surfaceMuted },
        ]}
      />
      <Text style={{ color: t.textSecondary, fontSize: 12 }}>
        Confirm with your terminal first, then tap charge to record the payment.
      </Text>
    </View>
  );
}

export function completePayTitle(method: PayMethod, submitting: boolean): string {
  if (submitting) return 'Saving…';
  if (method === 'CASH') return 'Complete payment';
  return `Charge ${method === 'CARD' ? 'Card' : 'UPI'}`;
}

export const QUICK_TENDER_STEPS = [0, 500, 1000, 2000, 5000];

export function buildQuickTenders(grandTotalCents: number): number[] {
  const set = new Set<number>([
    grandTotalCents,
    ...QUICK_TENDER_STEPS.map((b) => roundUpTo(grandTotalCents, b)),
  ]);
  return Array.from(set)
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
    .slice(0, 6);
}

function roundUpTo(amount: number, step: number): number {
  if (step <= 0) return amount;
  return Math.ceil(amount / step) * step;
}

const styles = StyleSheet.create({
  methodRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  refInput: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
