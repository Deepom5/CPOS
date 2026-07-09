import { create } from 'zustand';

import { DEFAULT_TAX_RATE_PERCENT } from '@/lib/constants';
import { calculateTotals, type OrderTotals } from '@/lib/pricing';

export interface CartLine {
  /** Stable id for this cart line (not the product id). */
  lineId: string;
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

/** Special key for the in-app "Takeaway" cart that isn't tied to a table. */
export const TAKEAWAY_KEY = 'takeaway';

interface CartState {
  cartsByTable: Record<string, CartLine[]>;
  activeTableKey: string;
  setActiveTable: (key: string) => void;
  add: (product: { id: string; name: string; unitPriceCents: number }) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  remove: (lineId: string) => void;
  /** Clear the active table's cart. */
  clear: () => void;
  /** Clear a specific table's cart (e.g. on checkout completion). */
  clearTable: (key: string) => void;
}

function newLineId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function bumpExisting(lines: CartLine[], lineId: string): CartLine[] {
  return lines.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l));
}

function addOrIncrement(
  lines: CartLine[],
  product: { id: string; name: string; unitPriceCents: number }
): CartLine[] {
  const existing = lines.find((l) => l.productId === product.id);
  if (existing) return bumpExisting(lines, existing.lineId);
  return [
    ...lines,
    {
      lineId: newLineId(),
      productId: product.id,
      name: product.name,
      unitPriceCents: product.unitPriceCents,
      quantity: 1,
    },
  ];
}

function incrementLine(lines: CartLine[], lineId: string): CartLine[] {
  return bumpExisting(lines, lineId);
}

function decrementLine(lines: CartLine[], lineId: string): CartLine[] {
  const updated = lines.map((l) =>
    l.lineId === lineId ? { ...l, quantity: l.quantity - 1 } : l
  );
  return updated.filter((l) => l.quantity > 0);
}

function removeLine(lines: CartLine[], lineId: string): CartLine[] {
  return lines.filter((l) => l.lineId !== lineId);
}

function applyToActive(
  state: CartState,
  fn: (lines: CartLine[]) => CartLine[]
): Pick<CartState, 'cartsByTable'> {
  const key = state.activeTableKey;
  const current = state.cartsByTable[key] ?? [];
  return { cartsByTable: { ...state.cartsByTable, [key]: fn(current) } };
}

export const useCartStore = create<CartState>((set) => ({
  cartsByTable: {},
  activeTableKey: TAKEAWAY_KEY,
  setActiveTable: (key) => set({ activeTableKey: key }),
  add: (product) => set((state) => applyToActive(state, (lines) => addOrIncrement(lines, product))),
  increment: (lineId) =>
    set((state) => applyToActive(state, (lines) => incrementLine(lines, lineId))),
  decrement: (lineId) =>
    set((state) => applyToActive(state, (lines) => decrementLine(lines, lineId))),
  remove: (lineId) => set((state) => applyToActive(state, (lines) => removeLine(lines, lineId))),
  clear: () => set((state) => applyToActive(state, () => [])),
  clearTable: (key) =>
    set((state) => {
      const next = { ...state.cartsByTable };
      delete next[key];
      return { cartsByTable: next };
    }),
}));

/**
 * Shared empty array used as a stable reference whenever a table has no cart.
 * Required so that zustand's `useSyncExternalStore` snapshot is referentially
 * stable between renders (otherwise React loops on "getSnapshot should be cached").
 */
const EMPTY_LINES: CartLine[] = [];

/** Lines for the currently-active table. */
export function useActiveCartLines(): CartLine[] {
  return useCartStore((s) => s.cartsByTable[s.activeTableKey] ?? EMPTY_LINES);
}

/** Lines for an explicit table key. */
export function useCartLinesFor(key: string): CartLine[] {
  return useCartStore((s) => s.cartsByTable[key] ?? EMPTY_LINES);
}

function totalsFor(lines: CartLine[]): OrderTotals {
  return calculateTotals({
    items: lines.map((l) => ({ unitPriceCents: l.unitPriceCents, quantity: l.quantity })),
    taxRatePercent: DEFAULT_TAX_RATE_PERCENT,
  });
}

export function useCartTotals(): OrderTotals {
  const lines = useActiveCartLines();
  return totalsFor(lines);
}

export function useTableTotals(key: string): OrderTotals {
  const lines = useCartLinesFor(key);
  return totalsFor(lines);
}

export function useCartItemCount(): number {
  return useActiveCartLines().reduce((n, l) => n + l.quantity, 0);
}

export function useTableItemCount(key: string): number {
  return useCartLinesFor(key).reduce((n, l) => n + l.quantity, 0);
}

/** Quantity for a given product on the currently-active table. */
export function useProductQuantity(productId: string): number {
  return useCartStore((s) => {
    const lines = s.cartsByTable[s.activeTableKey];
    if (!lines) return 0;
    return lines.find((l) => l.productId === productId)?.quantity ?? 0;
  });
}

/** Line id for a given product on the active table (or undefined). */
export function useProductLineId(productId: string): string | undefined {
  return useCartStore((s) => {
    const lines = s.cartsByTable[s.activeTableKey];
    if (!lines) return undefined;
    return lines.find((l) => l.productId === productId)?.lineId;
  });
}
