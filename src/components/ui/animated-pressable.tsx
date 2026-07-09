import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const AnimatedPressableNative = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  /** Press scale, default 0.96. */
  scaleTo?: number;
  /** Pressed opacity, default 0.9. */
  pressedOpacity?: number;
  style?: ViewStyle | ViewStyle[];
  /** Disable the press animation entirely. */
  noPressAnim?: boolean;
}

/**
 * Pressable that springs to a smaller scale + lower opacity on press.
 * Drop-in replacement for Pressable in most places.
 */
export const AnimatedPressable = forwardRef<unknown, AnimatedPressableProps>(function AnimatedPressable(
  { children, scaleTo = 0.96, pressedOpacity = 0.9, style, noPressAnim, disabled, ...rest },
  ref
) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const onPressIn: PressableProps['onPressIn'] = (e) => {
    if (!noPressAnim) {
      scale.value = withSpring(scaleTo, { mass: 0.4, damping: 14, stiffness: 320 });
      opacity.value = withTiming(pressedOpacity, { duration: 80 });
    }
    rest.onPressIn?.(e);
  };
  const onPressOut: PressableProps['onPressOut'] = (e) => {
    if (!noPressAnim) {
      scale.value = withSpring(1, { mass: 0.4, damping: 14, stiffness: 320 });
      opacity.value = withTiming(disabled ? 0.5 : 1, { duration: 120 });
    }
    rest.onPressOut?.(e);
  };

  return (
    <AnimatedPressableNative
      ref={ref as never}
      disabled={disabled}
      {...rest}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, animStyle, disabled ? { opacity: 0.5 } : null]}
    >
      {children}
    </AnimatedPressableNative>
  );
});
