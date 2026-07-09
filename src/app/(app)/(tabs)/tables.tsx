import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SyncStatusBanner } from '@/components/pos/sync-status-banner';
import { AnimatedMoney } from '@/components/ui/animated-money';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { AppButton } from '@/components/ui/app-button';
import { Pill } from '@/components/ui/pill';
import { Elevation, Radius } from '@/constants/pos-theme';
import { Spacing } from '@/constants/theme';
import { useTables } from '@/data/hooks/use-tables';
import type { RestaurantTableRow } from '@/data/schema';
import { usePosTheme } from '@/hooks/use-pos-theme';
import { notifySuccess, notifyWarning, tapLight, tapMedium } from '@/lib/haptics';
import {
    TAKEAWAY_KEY,
    useCartStore,
    useTableItemCount,
    useTableTotals,
} from '@/state/cart-store';

function pickColumnCount(width: number): number {
  if (width >= 1100) return 4;
  if (width >= 760) return 3;
  if (width >= 480) return 2;
  return 1;
}

type Tile =
  | { kind: 'takeaway' }
  | { kind: 'table'; row: RestaurantTableRow }
  | { kind: 'add' };

function TileSeparator() {
  return <View style={{ height: Spacing.three }} />;
}

export default function TablesHomeScreen() {
  const t = usePosTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = pickColumnCount(width);
  const { data: tables, loading, addTable, remove } = useTables();

  const [dialogOpen, setDialogOpen] = useState(false);

  const openTable = useCallback(
    (key: string) => {
      tapMedium();
      router.push(`/pos?table=${encodeURIComponent(key)}`);
    },
    [router]
  );

  const handleCreate = useCallback(
    async (name: string, seats: number) => {
      const row = await addTable({ name, seats });
      notifySuccess();
      setDialogOpen(false);
      router.push(`/pos?table=${encodeURIComponent(row.id)}`);
    },
    [addTable, router]
  );

  const clearTable = useCartStore((s) => s.clearTable);

  const performRemove = useCallback(
    async (row: RestaurantTableRow) => {
      tapLight();
      clearTable(row.id);
      await remove(row.id);
    },
    [clearTable, remove]
  );

  const handleRemove = useCallback(
    (row: RestaurantTableRow) => {
      notifyWarning();
      Alert.alert(
        `Delete ${row.name}?`,
        'This removes the table and clears any items on its open check.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void performRemove(row);
            },
          },
        ]
      );
    },
    [performRemove]
  );

  const tiles: Tile[] = [
    { kind: 'takeaway' },
    ...tables.map((row) => ({ kind: 'table' as const, row })),
    { kind: 'add' },
  ];

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: t.background }]}
      edges={['left', 'right']}
    >
      <View style={[styles.topBar, { borderBottomColor: t.border }]}>
        <SyncStatusBanner />
      </View>

      <View style={styles.header}>
        <Text style={{ color: t.textSecondary, fontSize: 14 }}>
          Open a table to start a check, or add a new one.
        </Text>
      </View>

      <FlatList
        data={tiles}
        key={`tiles-${numColumns}`}
        numColumns={numColumns}
        keyExtractor={(item, idx) => {
          if (item.kind === 'takeaway') return 'takeaway';
          if (item.kind === 'add') return 'add';
          return `table-${item.row.id}-${idx}`;
        }}
        columnWrapperStyle={numColumns > 1 ? { gap: Spacing.three } : undefined}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={TileSeparator}
        renderItem={({ item, index }) => (
          <TileItem
            tile={item}
            index={index}
            onOpen={openTable}
            onRemove={handleRemove}
            onOpenAdd={() => setDialogOpen(true)}
          />
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ padding: Spacing.four, alignItems: 'center' }}>
              <Text style={{ color: t.textSecondary }}>No tables yet.</Text>
            </View>
          )
        }
      />

      <AddTableDialog
        visible={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </SafeAreaView>
  );
}

interface TileItemProps {
  tile: Tile;
  index: number;
  onOpen: (key: string) => void;
  onRemove: (row: RestaurantTableRow) => void;
  onOpenAdd: () => void;
}

function TileItem({ tile, index, onOpen, onRemove, onOpenAdd }: Readonly<TileItemProps>) {
  if (tile.kind === 'takeaway') {
    return (
      <Animated.View
        style={{ flex: 1 }}
        entering={FadeInDown.delay(40).springify().damping(18)}
        layout={LinearTransition.springify().damping(18)}
      >
        <TableTile
          variant="takeaway"
          label="Takeaway"
          subtitle="Walk-in / counter"
          cartKey={TAKEAWAY_KEY}
          onPress={() => onOpen(TAKEAWAY_KEY)}
        />
      </Animated.View>
    );
  }
  if (tile.kind === 'add') {
    return (
      <Animated.View
        style={{ flex: 1 }}
        entering={FadeIn.delay(80).duration(220)}
        layout={LinearTransition.springify().damping(18)}
      >
        <AddTableTile onPress={onOpenAdd} />
      </Animated.View>
    );
  }
  const row = tile.row;
  return (
    <Animated.View
      style={{ flex: 1 }}
      entering={FadeInDown.delay(Math.min(index * 40, 240))
        .springify()
        .damping(18)}
      layout={LinearTransition.springify().damping(18)}
    >
      <TableTile
        variant="table"
        label={row.name}
        subtitle={row.seats > 0 ? `${row.seats} seats` : 'Dine-in'}
        cartKey={row.id}
        onPress={() => onOpen(row.id)}
        onDelete={() => onRemove(row)}
      />
    </Animated.View>
  );
}

interface TableTileProps {
  variant: 'takeaway' | 'table';
  label: string;
  subtitle: string;
  cartKey: string;
  onPress: () => void;
  onDelete?: () => void;
}

function TableTile({
  variant,
  label,
  subtitle,
  cartKey,
  onPress,
  onDelete,
}: Readonly<TableTileProps>) {
  const t = usePosTheme();
  const items = useTableItemCount(cartKey);
  const totals = useTableTotals(cartKey);
  const active = items > 0;
  const accent = variant === 'takeaway' ? t.warning : t.brand;
  const accentSoft = variant === 'takeaway' ? t.warningSoft : t.brandSoft;
  const itemLabel = `${items} item${items === 1 ? '' : 's'}`;

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      scaleTo={0.97}
      style={[
        styles.tile,
        Elevation.card,
        {
          backgroundColor: t.surface,
          borderColor: active ? accent : t.border,
        },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: accentSoft }]}>
        <Text style={{ fontSize: 26 }}>{variant === 'takeaway' ? '🥡' : '🍽️'}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pill label={active ? itemLabel : 'Empty'} tone={active ? 'brand' : 'neutral'} />
          {active ? (
            <AnimatedMoney
              cents={totals.grandTotalCents}
              style={{ color: t.text, fontWeight: '700', fontSize: 14 }}
            />
          ) : null}
        </View>
      </View>
      {onDelete ? (
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${label}`}
          onPress={onDelete}
          hitSlop={8}
          scaleTo={0.85}
          style={[
            styles.deleteBtn,
            { backgroundColor: t.dangerSoft, borderColor: t.danger },
          ]}
        >
          <Text style={{ color: t.danger, fontWeight: '800', fontSize: 14, lineHeight: 16 }}>
            ×
          </Text>
        </AnimatedPressable>
      ) : null}
    </AnimatedPressable>
  );
}

function AddTableTile({ onPress }: Readonly<{ onPress: () => void }>) {
  const t = usePosTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add a new table"
      scaleTo={0.96}
      style={[
        styles.tile,
        styles.tileDashed,
        {
          backgroundColor: t.surfaceMuted,
          borderColor: t.borderStrong,
        },
      ]}
    >
      <View
        style={[
          styles.tileIcon,
          { backgroundColor: t.brandSoft, borderRadius: Radius.pill },
        ]}
      >
        <Text style={{ color: t.brand, fontSize: 28, fontWeight: '700' }}>＋</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Add table</Text>
        <Text style={{ color: t.textSecondary, fontSize: 13 }}>
          Create a new dine-in table.
        </Text>
      </View>
    </AnimatedPressable>
  );
}

interface AddTableDialogProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, seats: number) => void | Promise<void>;
}

function AddTableDialog({ visible, onClose, onCreate }: Readonly<AddTableDialogProps>) {
  const t = usePosTheme();
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setSeats('');
    setError(null);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your table a name.');
      return;
    }
    setSaving(true);
    try {
      const parsedSeats = Number.parseInt(seats, 10);
      const seatCount = Number.isFinite(parsedSeats) && parsedSeats > 0 ? parsedSeats : 0;
      await onCreate(trimmed, seatCount);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the table.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.dialogWrap} onPress={() => {}}>
          <Animated.View
            entering={FadeInDown.springify().damping(18).mass(0.6)}
            style={[
              styles.dialog,
              Elevation.card,
              { backgroundColor: t.surface, borderColor: t.border },
            ]}
          >
            <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Add table</Text>
            <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: Spacing.two }}>
              Give it a friendly label and optional seat count.
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={{ color: t.textSecondary, fontSize: 12, fontWeight: '600' }}>
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Table 6"
                placeholderTextColor={t.textSecondary}
                autoFocus
                returnKeyType="next"
                style={[
                  styles.input,
                  { backgroundColor: t.surfaceMuted, color: t.text, borderColor: t.border },
                ]}
              />
            </View>

            <View style={{ gap: 6, marginTop: Spacing.two }}>
              <Text style={{ color: t.textSecondary, fontSize: 12, fontWeight: '600' }}>
                Seats (optional)
              </Text>
              <TextInput
                value={seats}
                onChangeText={setSeats}
                placeholder="4"
                placeholderTextColor={t.textSecondary}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                style={[
                  styles.input,
                  { backgroundColor: t.surfaceMuted, color: t.text, borderColor: t.border },
                ]}
              />
            </View>

            {error ? (
              <Text style={{ color: t.danger, marginTop: Spacing.two, fontSize: 13 }}>
                {error}
              </Text>
            ) : null}

            <View style={styles.dialogActions}>
              <AppButton title="Cancel" variant="ghost" onPress={handleClose} />
              <AppButton
                title={saving ? 'Saving…' : 'Add table'}
                variant="primary"
                onPress={handleSave}
                loading={saving}
                disabled={saving}
              />
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  header: {
    padding: Spacing.three,
    gap: 4,
  },
  list: {
    padding: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  tile: {
    flex: 1,
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  tileDashed: {
    borderStyle: 'dashed',
  },
  tileIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  dialogWrap: {
    width: '100%',
    maxWidth: 420,
  },
  dialog: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
