import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useDerivedValue,
    withTiming,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import type { CategoryRow } from '@/data/schema';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { selectionTick } from '@/lib/haptics';

export interface CategoryRailProps {
  categories: CategoryRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface Entry {
  id: string | null;
  name: string;
  color: string | null;
}

export function CategoryRail({ categories, selectedId, onSelect }: Readonly<CategoryRailProps>) {
  const entries: Entry[] = [
    { id: null, name: 'All', color: null },
    ...categories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
  ];
  return (
    <FlatList
      data={entries}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Spacing.two, paddingHorizontal: Spacing.three }}
      keyExtractor={(e) => e.id ?? '__all__'}
      renderItem={({ item }) => (
        <CategoryChip
          entry={item}
          active={selectedId === item.id}
          onPress={() => {
            if (selectedId !== item.id) selectionTick();
            onSelect(item.id);
          }}
        />
      )}
    />
  );
}

function CategoryChip({
  entry,
  active,
  onPress,
}: Readonly<{ entry: Entry; active: boolean; onPress: () => void }>) {
  const t = usePosTheme();
  const progress = useDerivedValue(() => withTiming(active ? 1 : 0, { duration: 180 }), [active]);

  const animStyle = useAnimatedStyle(() => {
    const bg = active ? t.brand : t.backgroundElement;
    return {
      backgroundColor: bg,
      borderColor: active ? t.brand : t.border,
      transform: [{ scale: 1 + progress.value * 0.02 }],
    };
  });

  return (
    <AnimatedPressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      scaleTo={0.94}
      style={styles.chip}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.chipBg, animStyle]} />
      {entry.color ? <View style={[styles.dot, { backgroundColor: entry.color }]} /> : null}
      <Text
        style={{
          color: active ? t.brandText : t.text,
          fontWeight: '600',
          fontSize: 14,
        }}
      >
        {entry.name}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  chipBg: {
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
