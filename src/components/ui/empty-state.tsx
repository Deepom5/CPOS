import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { usePosTheme } from '@/hooks/use-pos-theme';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: string;
}

export function EmptyState({ title, message, icon = '🛒' }: Readonly<EmptyStateProps>) {
  const t = usePosTheme();
  return (
    <View style={styles.wrap}>
      <Text style={{ fontSize: 48 }}>{icon}</Text>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '600' }}>{title}</Text>
      {message ? (
        <Text style={{ color: t.textSecondary, fontSize: 14, textAlign: 'center' }}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
