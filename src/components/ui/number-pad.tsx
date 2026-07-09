import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { selectionTick, tapSoft } from '@/lib/haptics';

export interface NumberPadProps {
  /** Current value in cents. */
  valueCents: number;
  /** Called with the next value in cents whenever a key is pressed. */
  onChange: (nextCents: number) => void;
  maxCents?: number;
}

const KEYS: (string | { label: string; value: string })[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  { label: '00', value: '00' },
  '0',
  { label: '⌫', value: 'back' },
];

export function NumberPad({ valueCents, onChange, maxCents }: Readonly<NumberPadProps>) {
  const t = usePosTheme();
  const handle = useMemo(
    () => (key: string) => {
      let next: number;
      if (key === 'back') {
        next = Math.floor(valueCents / 10);
      } else if (key === '00') {
        next = valueCents * 100;
      } else {
        next = valueCents * 10 + parseInt(key, 10);
      }
      if (maxCents !== undefined && next > maxCents) next = maxCents;
      if (!Number.isFinite(next) || next < 0) next = 0;
      onChange(next);
    },
    [valueCents, onChange, maxCents]
  );

  const onKeyPress = useCallback(
    (value: string) => {
      if (value === 'back') tapSoft();
      else selectionTick();
      handle(value);
    },
    [handle]
  );

  return (
    <View style={styles.grid}>
      {KEYS.map((k) => {
        const label = typeof k === 'string' ? k : k.label;
        const value = typeof k === 'string' ? k : k.value;
        const isBack = value === 'back';
        return (
          <AnimatedPressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`Key ${label}`}
            scaleTo={0.92}
            onPress={() => onKeyPress(value)}
            style={[
              styles.key,
              {
                backgroundColor: isBack ? t.dangerSoft : t.backgroundElement,
                borderColor: t.border,
              },
            ]}
          >
            <Text
              style={{
                color: isBack ? t.danger : t.text,
                fontSize: 22,
                fontWeight: '600',
              }}
            >
              {label}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  key: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
