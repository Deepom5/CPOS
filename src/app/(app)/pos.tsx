import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartPanel } from '@/components/pos/cart-panel';
import { CategoryRail } from '@/components/pos/category-rail';
import { ProductGrid } from '@/components/pos/product-grid';
import { SyncStatusBanner } from '@/components/pos/sync-status-banner';
import { AppButton } from '@/components/ui/app-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { useCategories, useProducts } from '@/data/hooks/use-menu';
import { useOpenTickets } from '@/data/hooks/use-open-tickets';
import { useTables } from '@/data/hooks/use-tables';
import { submitDineInOrder } from '@/data/repos/orders';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { notifyError, notifySuccess, tapMedium } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import {
    TAKEAWAY_KEY,
    useActiveCartLines,
    useCartItemCount,
    useCartStore,
} from '@/state/cart-store';
import { requestImmediateDrain } from '@/sync/engine';

export default function PosBillingScreen() {
  const t = usePosTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 820;
  const params = useLocalSearchParams<{ table?: string }>();
  const tableKey = params.table ?? TAKEAWAY_KEY;
  const isDineIn = tableKey !== TAKEAWAY_KEY;

  const { data: tables } = useTables();
  const tableName = useMemo(() => {
    if (tableKey === TAKEAWAY_KEY) return 'Takeaway';
    return tables.find((tbl) => tbl.id === tableKey)?.name ?? 'Order';
  }, [tableKey, tables]);

  const setActiveTable = useCartStore((s) => s.setActiveTable);
  useEffect(() => {
    setActiveTable(tableKey);
  }, [tableKey, setActiveTable]);

  const { data: categories, loading: categoriesLoading } = useCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { data: products } = useProducts(selectedCategoryId);

  const addToCart = useCartStore((s) => s.add);
  const clearTable = useCartStore((s) => s.clearTable);
  const itemCount = useCartItemCount();
  const lines = useActiveCartLines();
  const [submittingKds, setSubmittingKds] = useState(false);

  const { data: openTickets, refresh: refreshTickets } = useOpenTickets(
    isDineIn ? tableKey : null
  );

  const charge = () => {
    if (itemCount === 0) return;
    router.push(`/checkout?table=${encodeURIComponent(tableKey)}`);
  };

  const sendToKitchen = async () => {
    if (itemCount === 0 || !isDineIn || submittingKds) return;
    setSubmittingKds(true);
    try {
      await submitDineInOrder(
        db,
        lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
        })),
        { tableId: tableKey }
      );
      notifySuccess();
      clearTable(tableKey);
      requestImmediateDrain(db);
      void refreshTickets();
      router.replace('/tables');
    } catch {
      notifyError();
    } finally {
      setSubmittingKds(false);
    }
  };

  const kdsButton = isDineIn ? (
    <AppButton
      title={submittingKds ? 'Sending…' : 'Send to Kitchen'}
      variant="secondary"
      size="md"
      fullWidth
      loading={submittingKds}
      disabled={itemCount === 0 || submittingKds}
      onPress={sendToKitchen}
    />
  ) : null;

  const ticketBanners =
    isDineIn && openTickets.length > 0 ? (
      <View style={styles.banners}>
        {openTickets.map((tk) => (
          <OpenTicketBanner
            key={tk.order.id}
            orderNumber={tk.order.order_number}
            kitchenStatus={tk.order.kitchen_status}
            itemQty={tk.items.reduce((n, it) => n + it.quantity, 0)}
            totalCents={tk.order.grand_total_cents}
            onPress={() => {
              tapMedium();
              router.push(`/settle/${tk.order.id}`);
            }}
          />
        ))}
      </View>
    ) : null;

  const productPane =
    products.length === 0 && !categoriesLoading ? (
      <EmptyState
        title="No products"
        message="Add items to this category in your catalog."
        icon="🍽️"
      />
    ) : (
      <ProductGrid
        products={products}
        onAdd={(p) =>
          addToCart({ id: p.id, name: p.name, unitPriceCents: p.base_price_cents })
        }
      />
    );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: t.background }]}
      edges={['top', 'left', 'right']}
    >
      <Stack.Screen options={{ title: tableName }} />
      <View style={[styles.topBar, { borderBottomColor: t.border }]}>
        <SyncStatusBanner />
      </View>
      {ticketBanners}
      <View style={styles.body}>
        <View style={styles.menuPane}>
          <View style={{ paddingVertical: Spacing.two }}>
            <CategoryRail
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
            />
          </View>
          {productPane}
        </View>
        {isTablet ? (
          <CartPanel tableName={tableName} onCharge={charge} extraFooter={kdsButton} />
        ) : null}
      </View>
      {!isTablet ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.border, maxHeight: 360 }}>
          <CartPanel tableName={tableName} onCharge={charge} extraFooter={kdsButton} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  menuPane: {
    flex: 1,
  },
  banners: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  ticketBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
});

function ticketKitchenLabel(status: string): string {
  if (status === 'READY') return 'Ready';
  if (status === 'NEW') return 'Cooking';
  return 'Open';
}

interface OpenTicketBannerProps {
  orderNumber: number | null;
  kitchenStatus: string;
  itemQty: number;
  totalCents: number;
  onPress: () => void;
}

function OpenTicketBanner({
  orderNumber,
  kitchenStatus,
  itemQty,
  totalCents,
  onPress,
}: Readonly<OpenTicketBannerProps>) {
  const t = usePosTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.ticketBanner,
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Pill
          tone={kitchenStatus === 'READY' ? 'success' : 'warning'}
          label={ticketKitchenLabel(kitchenStatus)}
        />
        <Text style={{ color: t.text, fontWeight: '700' }}>
          {orderNumber == null ? 'Order' : `#${orderNumber}`}
        </Text>
        <Text style={{ color: t.textSecondary }}>{itemQty} items</Text>
      </View>
      <Text style={{ color: t.text, fontWeight: '700' }}>{formatMoney(totalCents)}</Text>
      <Text style={{ color: t.brand, fontWeight: '700', marginLeft: Spacing.two }}>
        Settle ›
      </Text>
    </Pressable>
  );
}
