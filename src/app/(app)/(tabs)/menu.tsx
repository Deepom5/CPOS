import { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { Elevation, Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { useMenuAdmin } from '@/data/hooks/use-menu-admin';
import type { CategoryRow, ProductRow } from '@/data/schema';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { notifyWarning, tapLight } from '@/lib/haptics';
import { formatMoney, toCents } from '@/lib/money';
import { useCan } from '@/state/auth-store';

export default function MenuAdminScreen() {
  const t = usePosTheme();
  const canManage = useCan('manage:menu');

  const {
    categories,
    products,
    loading,
    addCategory,
    renameCategoryById,
    removeCategory,
    addProduct,
    editProduct,
    removeProduct,
  } = useMenuAdmin();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [productDialog, setProductDialog] = useState<{
    mode: 'create' | 'edit';
    product?: ProductRow;
  } | null>(null);

  const effectiveCategory =
    selectedCategoryId ?? categories[0]?.id ?? null;

  const filteredProducts = useMemo(
    () =>
      effectiveCategory
        ? products.filter((p) => p.category_id === effectiveCategory)
        : products,
    [products, effectiveCategory]
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === effectiveCategory) ?? null,
    [categories, effectiveCategory]
  );

  if (!canManage) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={{ color: t.text, fontSize: 16 }}>
          Your role can’t edit the menu.
        </Text>
      </View>
    );
  }

  function confirmDeleteCategory(cat: CategoryRow) {
    notifyWarning();
    Alert.alert(
      'Delete category?',
      `“${cat.name}” and its products will be hidden from the menu.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void removeCategory(cat.id);
            if (selectedCategoryId === cat.id) setSelectedCategoryId(null);
          },
        },
      ]
    );
  }

  function confirmDeleteProduct(p: ProductRow) {
    notifyWarning();
    Alert.alert('Remove product?', `Remove “${p.name}” from the menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void removeProduct(p.id),
      },
    ]);
  }

  function promptRenameCategory(cat: CategoryRow) {
    Alert.prompt?.(
      'Rename category',
      undefined,
      (text) => {
        const trimmed = text?.trim();
        if (trimmed) void renameCategoryById(cat.id, trimmed);
      },
      'plain-text',
      cat.name
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: t.border }]}>
        <Text style={[styles.toolbarTitle, { color: t.text }]}>Categories</Text>
        <AppButton
          title="+ Category"
          size="sm"
          variant="secondary"
          onPress={() => {
            tapLight();
            setCatDialogOpen(true);
          }}
        />
      </View>

      <View style={styles.catRail}>
        {categories.length === 0 ? (
          <Text style={[styles.dim, { color: t.textSecondary }]}>
            {loading ? 'Loading…' : 'No categories yet.'}
          </Text>
        ) : (
          categories.map((cat) => {
            const active = cat.id === effectiveCategory;
            return (
              <CategoryChip
                key={cat.id}
                category={cat}
                active={active}
                onPress={() => setSelectedCategoryId(cat.id)}
                onLongPress={() => promptRenameCategory(cat)}
                onDelete={() => confirmDeleteCategory(cat)}
              />
            );
          })
        )}
      </View>

      <View style={[styles.productHeader, { borderBottomColor: t.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toolbarTitle, { color: t.text }]}>
            {selectedCategory ? selectedCategory.name : 'Products'}
          </Text>
          <Text style={[styles.dim, { color: t.textSecondary }]}>
            {filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'}
          </Text>
        </View>
        <AppButton
          title="+ Product"
          size="sm"
          variant="primary"
          disabled={!selectedCategory}
          onPress={() => {
            tapLight();
            setProductDialog({ mode: 'create' });
          }}
        />
      </View>

      {filteredProducts.length === 0 ? (
        <EmptyState
          title={selectedCategory ? 'No products' : 'Pick a category'}
          message={
            selectedCategory
              ? 'Add your first item with the + Product button.'
              : 'Choose a category above (or add one) to manage products.'
          }
          icon="🍔"
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Animated.View entering={FadeIn} style={styles.row}>
              <Card style={[styles.productCard, Elevation.card]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.productName, { color: t.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.dim, { color: t.textSecondary }]}>
                    {formatMoney(item.base_price_cents)}
                  </Text>
                </View>
                <View style={styles.productActions}>
                  <AppButton
                    title="Edit"
                    size="sm"
                    variant="ghost"
                    onPress={() => setProductDialog({ mode: 'edit', product: item })}
                  />
                  <AppButton
                    title="Delete"
                    size="sm"
                    variant="danger"
                    onPress={() => confirmDeleteProduct(item)}
                  />
                </View>
              </Card>
            </Animated.View>
          )}
        />
      )}

      {catDialogOpen ? (
        <CategoryDialog
          onCancel={() => setCatDialogOpen(false)}
          onCreate={async (name) => {
            const created = await addCategory({ name });
            setCatDialogOpen(false);
            setSelectedCategoryId(created.id);
          }}
        />
      ) : null}

      {productDialog ? (
        <ProductDialog
          initial={productDialog.product}
          onCancel={() => setProductDialog(null)}
          onSubmit={async ({ name, basePriceCents }) => {
            if (productDialog.mode === 'create') {
              if (!selectedCategory) return;
              await addProduct({
                categoryId: selectedCategory.id,
                name,
                basePriceCents,
              });
            } else if (productDialog.product) {
              await editProduct(productDialog.product.id, {
                name,
                basePriceCents,
              });
            }
            setProductDialog(null);
          }}
        />
      ) : null}
    </View>
  );
}

// ─────────────────────────────── chips ────────────────────────────────

interface CategoryChipProps {
  category: CategoryRow;
  active: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
}

function CategoryChip({
  category,
  active,
  onPress,
  onLongPress,
  onDelete,
}: Readonly<CategoryChipProps>) {
  const t = usePosTheme();
  return (
    <View style={styles.chipWrap}>
      <AnimatedPressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={[
          styles.chip,
          {
            backgroundColor: active ? t.brand : t.surfaceMuted,
            borderColor: active ? t.brand : t.border,
          },
        ]}
      >
        <Text
          style={{ color: active ? t.brandText : t.text, fontWeight: '600' }}
          numberOfLines={1}
        >
          {category.name}
        </Text>
      </AnimatedPressable>
      <Pressable onPress={onDelete} hitSlop={8} style={[styles.chipX, { backgroundColor: t.danger }]}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>×</Text>
      </Pressable>
    </View>
  );
}

// ───────────────────────────── dialogs ────────────────────────────────

interface CategoryDialogProps {
  onCancel: () => void;
  onCreate: (name: string) => Promise<void> | void;
}

function CategoryDialog({ onCancel, onCreate }: Readonly<CategoryDialogProps>) {
  const t = usePosTheme();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const canSubmit = name.trim().length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onCreate(name.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.modalTitle, { color: t.text }]}>New category</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="e.g. Desserts"
            placeholderTextColor={t.textSecondary}
            style={[
              styles.input,
              { borderColor: t.border, color: t.text, backgroundColor: t.surfaceMuted },
            ]}
          />
          <View style={styles.modalActions}>
            <AppButton title="Cancel" variant="ghost" onPress={onCancel} />
            <AppButton title="Create" loading={busy} disabled={!canSubmit} onPress={submit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ProductDialogProps {
  initial?: ProductRow;
  onCancel: () => void;
  onSubmit: (input: { name: string; basePriceCents: number }) => Promise<void> | void;
}

function ProductDialog({ initial, onCancel, onSubmit }: Readonly<ProductDialogProps>) {
  const t = usePosTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(
    initial ? (initial.base_price_cents / 100).toFixed(2) : ''
  );
  const [busy, setBusy] = useState(false);
  const parsedPrice = Number(price);
  const canSubmit = name.trim().length > 0 && parsedPrice > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        basePriceCents: toCents(parsedPrice),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.modalTitle, { color: t.text }]}>
            {initial ? 'Edit product' : 'New product'}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="Name"
            placeholderTextColor={t.textSecondary}
            style={[
              styles.input,
              { borderColor: t.border, color: t.text, backgroundColor: t.surfaceMuted },
            ]}
          />
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Price"
            keyboardType="decimal-pad"
            placeholderTextColor={t.textSecondary}
            style={[
              styles.input,
              { borderColor: t.border, color: t.text, backgroundColor: t.surfaceMuted },
            ]}
          />
          {initial ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <Pill label="Existing product" tone="neutral" />
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <AppButton title="Cancel" variant="ghost" onPress={onCancel} />
            <AppButton title="Save" loading={busy} disabled={!canSubmit} onPress={submit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarTitle: { fontSize: 18, fontWeight: '800' },
  catRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  chipWrap: { position: 'relative' },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  chipX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { padding: Spacing.two, gap: Spacing.two },
  row: { padding: Spacing.one },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  productName: { fontSize: 16, fontWeight: '700' },
  productActions: { flexDirection: 'row', gap: Spacing.one },
  dim: { fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
