import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Elevation, Radius } from '@/constants/pos-theme';
import { usePosTheme } from '@/hooks/use-pos-theme';

export interface CardProps extends ViewProps {
  padded?: boolean;
  surface?: 'default' | 'muted';
  children: ReactNode;
}

export function Card({ style, padded = true, surface = 'default', children, ...rest }: Readonly<CardProps>) {
  const t = usePosTheme();
  return (
    <View
      style={[
        styles.base,
        Elevation.card,
        {
          backgroundColor: surface === 'muted' ? t.surfaceMuted : t.surface,
          borderColor: t.border,
          padding: padded ? 16 : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
});
