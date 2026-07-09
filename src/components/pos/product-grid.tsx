import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Elevation, Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import type { ProductRow } from '@/data/schema';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { selectionTick, tapLight, tapSoft } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import {
    useCartStore,
    useProductLineId,
    useProductQuantity,
} from '@/state/cart-store';

export interface ProductGridProps {
  products: ProductRow[];
  onAdd: (p: ProductRow) => void;
}

function pickColumnCount(width: number): number {
  if (width >= 900) return 4;
  if (width >= 600) return 3;
  return 2;
}

export function ProductGrid({ products, onAdd }: Readonly<ProductGridProps>) {
  const { width } = useWindowDimensions();
  const numColumns = pickColumnCount(width);
  return (
    <FlatList
      data={products}
      key={`grid-${numColumns}`}
      numColumns={numColumns}
      keyExtractor={(p) => p.id}
      columnWrapperStyle={{ gap: Spacing.three }}
      contentContainerStyle={{
        padding: Spacing.three,
        gap: Spacing.three,
      }}
      renderItem={({ item, index }) => (
        <ProductCard product={item} index={index} onAdd={() => onAdd(item)} />
      )}
    />
  );
}

function ProductCard({
  product,
  index,
  onAdd,
}: Readonly<{ product: ProductRow; index: number; onAdd: () => void }>) {
  const t = usePosTheme();
  const quantity = useProductQuantity(product.id);
  const lineId = useProductLineId(product.id);
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);

  const flash = useSharedValue(0); // 0..1 brand glow on add
  const badgeY = useSharedValue(0); // floats up when item added
  const badgeOpacity = useSharedValue(0);

  const triggerFlash = useCallback(() => {
    flash.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 320 })
    );
    badgeOpacity.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(0, { duration: 500 })
    );
    badgeY.value = 0;
    badgeY.value = withSpring(-24, { mass: 0.4, damping: 12, stiffness: 180 });
  }, [flash, badgeOpacity, badgeY]);

  const handlePress = useCallback(() => {
    tapLight();
    onAdd();
    triggerFlash();
  }, [onAdd, triggerFlash]);

  const handleInc = useCallback(() => {
    selectionTick();
    if (lineId) {
      increment(lineId);
    } else {
      onAdd();
    }
    triggerFlash();
  }, [lineId, increment, onAdd, triggerFlash]);

  const handleDec = useCallback(() => {
    tapSoft();
    if (lineId) decrement(lineId);
  }, [lineId, decrement]);

  const cardAnim = useAnimatedStyle(() => ({
    borderColor: flash.value > 0 ? t.brand : t.border,
    borderWidth: 1 + flash.value,
  }));
  const badgeAnim = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeY.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index * 24, 240)).duration(220)}
      style={{ flex: 1 }}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name}`}
        onPress={handlePress}
        style={[styles.card, Elevation.card, { backgroundColor: t.surface }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.cardBorder, cardAnim]}
        />
        <View style={[styles.thumb, { backgroundColor: t.brandSoft }]}>
          <Text style={{ color: t.brand, fontSize: 28, fontWeight: '700' }}>
            {product.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>
          {product.name}
        </Text>
        <View style={styles.footer}>
          <Text style={{ color: t.textSecondary, fontSize: 13 }}>
            {formatMoney(product.base_price_cents)}
          </Text>
          {quantity > 0 ? (
            <View
              style={[styles.qtyRow, { backgroundColor: t.brandSoft, borderColor: t.brand }]}
            >
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel={`Remove one ${product.name}`}
                onPress={handleDec}
                scaleTo={0.85}
                style={styles.qtyBtn}
              >
                <Text style={{ color: t.brand, fontWeight: '800', fontSize: 16 }}>−</Text>
              </AnimatedPressable>
              <Text
                style={{
                  color: t.brand,
                  fontWeight: '800',
                  fontSize: 14,
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {quantity}
              </Text>
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel={`Add another ${product.name}`}
                onPress={handleInc}
                scaleTo={0.85}
                style={styles.qtyBtn}
              >
                <Text style={{ color: t.brand, fontWeight: '800', fontSize: 16 }}>＋</Text>
              </AnimatedPressable>
            </View>
          ) : null}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.plusBadge, { backgroundColor: t.brand }, badgeAnim]}
        >
          <Text style={{ color: t.brandText, fontWeight: '700', fontSize: 12 }}>+1</Text>
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    minHeight: 140,
    overflow: 'hidden',
  },
  cardBorder: {
    borderRadius: Radius.lg,
  },
  thumb: {
    height: 64,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
