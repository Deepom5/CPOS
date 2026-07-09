import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/pos-theme';
import { usePosTheme } from '@/hooks/use-pos-theme';

export type PillTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface PillProps {
  label: string;
  tone?: PillTone;
}

export function Pill({ label, tone = 'neutral' }: Readonly<PillProps>) {
  const t = usePosTheme();
  const map: Record<PillTone, { bg: string; fg: string }> = {
    neutral: { bg: t.backgroundElement, fg: t.text },
    brand: { bg: t.brandSoft, fg: t.brand },
    success: { bg: t.successSoft, fg: t.success },
    warning: { bg: t.warningSoft, fg: t.warning },
    danger: { bg: t.dangerSoft, fg: t.danger },
  };
  const palette = map[tone];
  return (
    <View style={[styles.base, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
});
