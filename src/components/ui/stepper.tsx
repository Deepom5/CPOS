import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Radius } from '@/constants/pos-theme';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { selectionTick } from '@/lib/haptics';

export interface StepperProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
  compact?: boolean;
}

export function Stepper({
  value,
  onIncrement,
  onDecrement,
  min = 0,
  max,
  compact,
}: Readonly<StepperProps>) {
  const t = usePosTheme();
  const size = compact ? 28 : 36;
  const fontSize = compact ? 16 : 18;
  const decrementDisabled = value <= min;
  const incrementDisabled = max !== undefined && value >= max;

  const valueScale = useSharedValue(1);
  useEffect(() => {
    valueScale.value = withSequence(
      withSpring(1.2, { mass: 0.3, damping: 10, stiffness: 400 }),
      withSpring(1, { mass: 0.3, damping: 12, stiffness: 300 })
    );
  }, [value, valueScale]);

  const valueAnim = useAnimatedStyle(() => ({
    transform: [{ scale: valueScale.value }],
  }));

  const handleDec = () => {
    if (decrementDisabled) return;
    selectionTick();
    onDecrement();
  };
  const handleInc = () => {
    if (incrementDisabled) return;
    selectionTick();
    onIncrement();
  };

  return (
    <View style={[styles.row, { borderColor: t.border }]}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        onPress={handleDec}
        disabled={decrementDisabled}
        scaleTo={0.85}
        style={[styles.btn, { width: size, height: size }]}
      >
        <Text style={{ color: t.text, fontSize, fontWeight: '600' }}>−</Text>
      </AnimatedPressable>
      <Animated.Text
        style={[
          {
            minWidth: compact ? 24 : 32,
            textAlign: 'center',
            color: t.text,
            fontSize,
            fontWeight: '600',
          },
          valueAnim,
        ]}
      >
        {value}
      </Animated.Text>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        onPress={handleInc}
        disabled={incrementDisabled}
        scaleTo={0.85}
        style={[styles.btn, { width: size, height: size }]}
      >
        <Text style={{ color: t.text, fontSize, fontWeight: '600' }}>+</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 4,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
