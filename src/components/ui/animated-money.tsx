import { useEffect } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from 'react-native-reanimated';

import { formatMoney } from '@/lib/money';

export interface AnimatedMoneyProps {
  cents: number;
  style?: TextStyle | TextStyle[];
  /** When true, no scale bump on change. */
  noBump?: boolean;
}

/**
 * Money label that springs (scale bump) whenever the value changes. The label
 * itself is rendered as plain text — only the wrapper scales.
 */
export function AnimatedMoney({ cents, style, noBump }: Readonly<AnimatedMoneyProps>) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (noBump) return;
    scale.value = withSequence(
      withSpring(1.12, { mass: 0.3, damping: 9, stiffness: 360 }),
      withSpring(1, { mass: 0.3, damping: 14, stiffness: 280 })
    );
  }, [cents, scale, noBump]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, anim]}>
      <Animated.Text style={style}>{formatMoney(cents)}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-end',
  },
});
