import { type ReactNode } from 'react';
import {
    ActivityIndicator,
    type GestureResponderEvent,
    type PressableProps,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { tapLight, tapMedium } from '@/lib/haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  /** Haptic intensity on press. Defaults: primary/danger/success=medium, others=light. */
  haptic?: 'none' | 'light' | 'medium';
}

function pickBg(variant: ButtonVariant, t: ReturnType<typeof usePosTheme>): string {
  switch (variant) {
    case 'primary':
      return t.brand;
    case 'danger':
      return t.danger;
    case 'success':
      return t.success;
    case 'secondary':
      return t.backgroundElement;
    default:
      return 'transparent';
  }
}

function pickFg(variant: ButtonVariant, t: ReturnType<typeof usePosTheme>): string {
  if (variant === 'primary' || variant === 'danger' || variant === 'success') {
    return t.brandText;
  }
  return t.text;
}

function defaultHaptic(variant: ButtonVariant): 'light' | 'medium' {
  if (variant === 'primary' || variant === 'danger' || variant === 'success') return 'medium';
  return 'light';
}

const SIZE_PAD_V: Record<ButtonSize, number> = { sm: 8, md: 12, lg: 16 };
const SIZE_PAD_H: Record<ButtonSize, number> = { sm: 12, md: 16, lg: 20 };
const SIZE_FONT: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 17 };

export function AppButton({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  leadingIcon,
  trailingIcon,
  fullWidth,
  disabled,
  haptic,
  onPressIn,
  ...rest
}: Readonly<AppButtonProps>) {
  const t = usePosTheme();
  const isDisabled = disabled || loading;
  const bg = pickBg(variant, t);
  const fg = pickFg(variant, t);
  const borderColor = variant === 'ghost' ? t.border : 'transparent';
  const padV = SIZE_PAD_V[size];
  const padH = SIZE_PAD_H[size];
  const fontSize = SIZE_FONT[size];
  const intensity = haptic ?? defaultHaptic(variant);

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!isDisabled && intensity !== 'none') {
      if (intensity === 'medium') tapMedium();
      else tapLight();
    }
    onPressIn?.(e);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      scaleTo={size === 'lg' ? 0.97 : 0.95}
      onPressIn={handlePressIn}
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          paddingVertical: padV,
          paddingHorizontal: padH,
          width: fullWidth ? '100%' : undefined,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {leadingIcon}
          <Text style={{ color: fg, fontSize, fontWeight: '600' }}>{title}</Text>
          {trailingIcon}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
