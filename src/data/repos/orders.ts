import type { SQLiteDatabase } from 'expo-sqlite';

import {
    DEFAULT_TAX_RATE_PERCENT,
    DEMO_DEVICE_ID,
    DEMO_EMPLOYEE_ID,
    DEMO_LOCATION_ID,
    DEMO_TENANT_ID,
} from '@/lib/constants';
import { calculateTotals, lineSubtotal, type PricingItem } from '@/lib/pricing';
import { uuidv4, uuidv7 } from '@/lib/uuid';

import type {
    KitchenStatus,
    OrderItemRow,
    OrderRow,
    PaymentMethod,
    PaymentRow,
} from '../schema';
import { appendOutbox } from './outbox';

export interface CartLine {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface SubmittedOrder {
  order: OrderRow;
  items: OrderItemRow[];
  payment: PaymentRow;
}

export interface KitchenOrder {
  order: OrderRow;
  items: OrderItemRow[];
}

export interface PersistOrderOptions {
  tableId?: string | null;
}

export interface PaymentInput {
  method: PaymentMethod;
  /** For cash, the amount the customer handed over (>= grand total). */
  tenderedCents?: number;
  /** Card auth code / UPI reference / etc. */
  reference?: string | null;
}

// ────────────────────────────── public API ──────────────────────────────

/**
 * Persist a fully-paid cash order. Kept for backwards compatibility — internally
 * delegates to {@link persistPaidOrder}.
 */
export async function persistCashOrder(
  db: SQLiteDatabase,
  lines: CartLine[],
  tenderedCents: number,
  options: PersistOrderOptions = {}
): Promise<SubmittedOrder> {
  return persistPaidOrder(db, lines, { method: 'CASH', tenderedCents }, options);
}

/**
 * Persist a paid order atomically. Cash orders compute change from
 * `tenderedCents`; other methods assume the exact amount was captured.
 */
export async function persistPaidOrder(
  db: SQLiteDatabase,
  lines: CartLine[],
  payment: PaymentInput,
  options: PersistOrderOptions = {}
): Promise<SubmittedOrder> {
  if (lines.length === 0) throw new Error('Cannot submit an empty order');

  const now = Date.now();
  const totals = computeTotals(lines);
  const tendered =
    payment.method === 'CASH' ? (payment.tenderedCents ?? totals.grandTotalCents) : null;
  if (payment.method === 'CASH' && tendered !== null && tendered < totals.grandTotalCents) {
    throw new Error('Tendered amount is less than the grand total');
  }
  const change = tendered === null ? null : tendered - totals.grandTotalCents;

  const orderNumber = await nextOrderNumber(db);
  const orderRow = buildOrderRow({
    now,
    totals,
    options,
    orderNumber,
    status: 'PAID',
    // Paid orders still need to be prepared in the kitchen. The ticket lands
    // on the KDS as NEW and the kitchen bumps it to SERVED when plated.
    kitchenStatus: 'NEW',
    submittedAt: now,
    closedAt: now,
  });
  const itemRows = buildItemRows(orderRow.id, lines, now);
  const paymentRow = buildPaymentRow({
    orderId: orderRow.id,
    method: payment.method,
    amountCents: totals.grandTotalCents,
    tenderedCents: tendered,
    changeCents: change,
    reference: payment.reference ?? null,
    now,
  });

  const batchId = uuidv4();
  await db.withTransactionAsync(async () => {
    await insertOrder(db, orderRow);
    for (const item of itemRows) await insertItem(db, item);
    await insertPayment(db, paymentRow);
    await queueOutboxForOrder(db, batchId, orderRow, itemRows, paymentRow);
  });

  return { order: orderRow, items: itemRows, payment: paymentRow };
}

/**
 * Persist a dine-in order WITHOUT payment. The order lands on the KDS for the
 * kitchen to prepare; the waiter calls {@link addPaymentToExistingOrder} later
 * when the customer pays.
 */
export async function submitDineInOrder(
  db: SQLiteDatabase,
  lines: CartLine[],
  options: PersistOrderOptions = {}
): Promise<KitchenOrder> {
  if (lines.length === 0) throw new Error('Cannot submit an empty order');
  if (!options.tableId) throw new Error('Dine-in orders require a tableId');

  const now = Date.now();
  const totals = computeTotals(lines);
  const orderNumber = await nextOrderNumber(db);
  const orderRow = buildOrderRow({
    now,
    totals,
    options,
    orderNumber,
    status: 'SUBMITTED',
    kitchenStatus: 'NEW',
    submittedAt: now,
    closedAt: null,
  });
  const itemRows = buildItemRows(orderRow.id, lines, now);

  const batchId = uuidv4();
  await db.withTransactionAsync(async () => {
    await insertOrder(db, orderRow);
    for (const item of itemRows) await insertItem(db, item);
    await appendOutbox(db, batchId, {
      entityType: 'order',
      entityId: orderRow.id,
      operation: 'create',
      payload: orderRow,
      baseVersion: 0,
    });
    for (const item of itemRows) {
      await appendOutbox(db, batchId, {
        entityType: 'order_item',
        entityId: item.id,
        operation: 'create',
        payload: item,
        baseVersion: 0,
      });
    }
  });

  return { order: orderRow, items: itemRows };
}

/**
 * Capture a payment against an existing (typically SUBMITTED) order and close
 * it. Returns the persisted snapshot for the receipt screen.
 */
export async function addPaymentToExistingOrder(
  db: SQLiteDatabase,
  orderId: string,
  payment: PaymentInput
): Promise<SubmittedOrder> {
  const order = await db.getFirstAsync<OrderRow>(
    `SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL`,
    [orderId]
  );
  if (!order) throw new Error('Order not found');
  if (order.status === 'PAID') throw new Error('Order is already paid');

  const now = Date.now();
  const tendered =
    payment.method === 'CASH' ? (payment.tenderedCents ?? order.grand_total_cents) : null;
  if (payment.method === 'CASH' && tendered !== null && tendered < order.grand_total_cents) {
    throw new Error('Tendered amount is less than the grand total');
  }
  const change = tendered === null ? null : tendered - order.grand_total_cents;

  const paymentRow = buildPaymentRow({
    orderId: order.id,
    method: payment.method,
    amountCents: order.grand_total_cents,
    tenderedCents: tendered,
    changeCents: change,
    reference: payment.reference ?? null,
    now,
  });

  const batchId = uuidv4();
  await db.withTransactionAsync(async () => {
    await insertPayment(db, paymentRow);
    await db.runAsync(
      `UPDATE orders
          SET status = 'PAID',
              closed_at = ?,
              kitchen_status = CASE WHEN kitchen_status IN ('NEW','READY') THEN 'SERVED' ELSE kitchen_status END,
              updated_at = ?,
              version = version + 1,
              sync_status = 'pending'
        WHERE id = ?`,
      [now, now, order.id]
    );
    await appendOutbox(db, batchId, {
      entityType: 'payment',
      entityId: paymentRow.id,
      operation: 'create',
      payload: paymentRow,
      baseVersion: 0,
    });
    await appendOutbox(db, batchId, {
      entityType: 'order',
      entityId: order.id,
      operation: 'update',
      payload: { id: order.id, status: 'PAID', closed_at: now },
      baseVersion: order.version,
    });
  });

  const updated = await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id = ?', [
    order.id,
  ]);
  if (!updated) throw new Error('Order vanished after payment');
  const items = await db.getAllAsync<OrderItemRow>(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC',
    [order.id]
  );
  return { order: updated, items, payment: paymentRow };
}

export async function markKitchenStatus(
  db: SQLiteDatabase,
  orderId: string,
  status: Exclude<KitchenStatus, 'NONE'>
): Promise<void> {
  const now = Date.now();
  const readyAt = status === 'READY' ? now : null;
  await db.runAsync(
    `UPDATE orders
        SET kitchen_status = ?,
            kitchen_ready_at = COALESCE(?, kitchen_ready_at),
            updated_at = ?,
            version = version + 1,
            sync_status = 'pending'
      WHERE id = ?`,
    [status, readyAt, now, orderId]
  );
}

export async function listOpenKitchenOrders(db: SQLiteDatabase): Promise<KitchenOrder[]> {
  const orders = await db.getAllAsync<OrderRow>(
    `SELECT * FROM orders
      WHERE deleted_at IS NULL
        AND kitchen_status IN ('NEW','READY')
      ORDER BY created_at ASC`
  );
  return attachItems(db, orders);
}

export async function listOpenOrdersForTable(
  db: SQLiteDatabase,
  tableId: string
): Promise<KitchenOrder[]> {
  const orders = await db.getAllAsync<OrderRow>(
    `SELECT * FROM orders
      WHERE deleted_at IS NULL
        AND table_id = ?
        AND status IN ('SUBMITTED','PARTIALLY_PAID')
      ORDER BY created_at ASC`,
    [tableId]
  );
  return attachItems(db, orders);
}

export async function getOrderById(
  db: SQLiteDatabase,
  orderId: string
): Promise<SubmittedOrder | null> {
  const order = await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return null;
  const items = await db.getAllAsync<OrderItemRow>(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC',
    [orderId]
  );
  const payment = await db.getFirstAsync<PaymentRow>(
    'SELECT * FROM payments WHERE order_id = ? ORDER BY captured_at DESC LIMIT 1',
    [orderId]
  );
  if (!payment) return null;
  return { order, items, payment };
}

// ────────────────────────────── helpers ─────────────────────────────────

async function attachItems(
  db: SQLiteDatabase,
  orders: OrderRow[]
): Promise<KitchenOrder[]> {
  if (orders.length === 0) return [];
  const ids = orders.map((o) => o.id);
  const placeholders = ids.map(() => '?').join(',');
  const items = await db.getAllAsync<OrderItemRow>(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`,
    ids
  );
  const byOrder = new Map<string, OrderItemRow[]>();
  for (const it of items) {
    const list = byOrder.get(it.order_id) ?? [];
    list.push(it);
    byOrder.set(it.order_id, list);
  }
  return orders.map((order) => ({ order, items: byOrder.get(order.id) ?? [] }));
}

function computeTotals(lines: CartLine[]) {
  const pricingItems: PricingItem[] = lines.map((l) => ({
    unitPriceCents: l.unitPriceCents,
    quantity: l.quantity,
  }));
  return calculateTotals({
    items: pricingItems,
    taxRatePercent: DEFAULT_TAX_RATE_PERCENT,
  });
}

interface BuildOrderArgs {
  now: number;
  totals: ReturnType<typeof computeTotals>;
  options: PersistOrderOptions;
  orderNumber: number;
  status: OrderRow['status'];
  kitchenStatus: KitchenStatus;
  submittedAt: number | null;
  closedAt: number | null;
}

function buildOrderRow(args: BuildOrderArgs): OrderRow {
  const { now, totals, options, orderNumber, status, kitchenStatus, submittedAt, closedAt } =
    args;
  return {
    id: uuidv7(),
    tenant_id: DEMO_TENANT_ID,
    location_id: DEMO_LOCATION_ID,
    order_number: orderNumber,
    channel: options.tableId ? 'DINE_IN' : 'TAKEAWAY',
    table_id: options.tableId ?? null,
    customer_id: null,
    opened_by_id: DEMO_EMPLOYEE_ID,
    status,
    subtotal_cents: totals.subtotalCents,
    discount_cents: totals.discountCents,
    tax_cents: totals.taxCents,
    service_charge_cents: totals.serviceChargeCents,
    tip_cents: totals.tipCents,
    grand_total_cents: totals.grandTotalCents,
    notes: null,
    kitchen_notes: null,
    submitted_at: submittedAt,
    closed_at: closedAt,
    voided_at: null,
    kitchen_status: kitchenStatus,
    kitchen_ready_at: null,
    version: 1,
    server_version: 0,
    sync_status: 'pending',
    sync_error: null,
    last_synced_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    device_id: DEMO_DEVICE_ID,
  };
}

function buildItemRows(orderId: string, lines: CartLine[], now: number): OrderItemRow[] {
  return lines.map((line) => ({
    id: uuidv7(),
    order_id: orderId,
    product_id: line.productId,
    variant_id: null,
    name_snapshot: line.name,
    unit_price_cents: line.unitPriceCents,
    quantity: line.quantity,
    modifiers_json: '[]',
    notes: null,
    line_subtotal_cents: lineSubtotal({
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
    }),
    line_tax_cents: 0,
    voided: 0,
    created_at: now,
    updated_at: now,
  }));
}

interface BuildPaymentArgs {
  orderId: string;
  method: PaymentMethod;
  amountCents: number;
  tenderedCents: number | null;
  changeCents: number | null;
  reference: string | null;
  now: number;
}

function buildPaymentRow(args: BuildPaymentArgs): PaymentRow {
  return {
    id: uuidv7(),
    tenant_id: DEMO_TENANT_ID,
    location_id: DEMO_LOCATION_ID,
    order_id: args.orderId,
    method: args.method,
    amount_cents: args.amountCents,
    tendered_cents: args.tenderedCents,
    change_cents: args.changeCents,
    reference: args.reference,
    status: 'CAPTURED',
    captured_at: args.now,
    created_at: args.now,
    version: 1,
    server_version: 0,
    sync_status: 'pending',
    sync_error: null,
    last_synced_at: null,
    device_id: DEMO_DEVICE_ID,
  };
}

async function insertOrder(db: SQLiteDatabase, row: OrderRow): Promise<void> {
  await db.runAsync(
    `INSERT INTO orders
      (id, tenant_id, location_id, order_number, channel, table_id, customer_id,
       opened_by_id, status, subtotal_cents, discount_cents, tax_cents,
       service_charge_cents, tip_cents, grand_total_cents, notes, kitchen_notes,
       submitted_at, closed_at, voided_at, kitchen_status, kitchen_ready_at,
       version, server_version, sync_status, sync_error, last_synced_at,
       created_at, updated_at, deleted_at, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.tenant_id,
      row.location_id,
      row.order_number,
      row.channel,
      row.table_id,
      row.customer_id,
      row.opened_by_id,
      row.status,
      row.subtotal_cents,
      row.discount_cents,
      row.tax_cents,
      row.service_charge_cents,
      row.tip_cents,
      row.grand_total_cents,
      row.notes,
      row.kitchen_notes,
      row.submitted_at,
      row.closed_at,
      row.voided_at,
      row.kitchen_status,
      row.kitchen_ready_at,
      row.version,
      row.server_version,
      row.sync_status,
      row.sync_error,
      row.last_synced_at,
      row.created_at,
      row.updated_at,
      row.deleted_at,
      row.device_id,
    ]
  );
}

async function insertItem(db: SQLiteDatabase, item: OrderItemRow): Promise<void> {
  await db.runAsync(
    `INSERT INTO order_items
      (id, order_id, product_id, variant_id, name_snapshot, unit_price_cents,
       quantity, modifiers_json, notes, line_subtotal_cents, line_tax_cents,
       voided, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.order_id,
      item.product_id,
      item.variant_id,
      item.name_snapshot,
      item.unit_price_cents,
      item.quantity,
      item.modifiers_json,
      item.notes,
      item.line_subtotal_cents,
      item.line_tax_cents,
      item.voided,
      item.created_at,
      item.updated_at,
    ]
  );
}

async function insertPayment(db: SQLiteDatabase, p: PaymentRow): Promise<void> {
  await db.runAsync(
    `INSERT INTO payments
      (id, tenant_id, location_id, order_id, method, amount_cents, tendered_cents,
       change_cents, reference, status, captured_at, created_at,
       version, server_version, sync_status, sync_error, last_synced_at, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.tenant_id,
      p.location_id,
      p.order_id,
      p.method,
      p.amount_cents,
      p.tendered_cents,
      p.change_cents,
      p.reference,
      p.status,
      p.captured_at,
      p.created_at,
      p.version,
      p.server_version,
      p.sync_status,
      p.sync_error,
      p.last_synced_at,
      p.device_id,
    ]
  );
}

async function queueOutboxForOrder(
  db: SQLiteDatabase,
  batchId: string,
  order: OrderRow,
  items: OrderItemRow[],
  payment: PaymentRow
): Promise<void> {
  await appendOutbox(db, batchId, {
    entityType: 'order',
    entityId: order.id,
    operation: 'create',
    payload: order,
    baseVersion: 0,
  });
  for (const item of items) {
    await appendOutbox(db, batchId, {
      entityType: 'order_item',
      entityId: item.id,
      operation: 'create',
      payload: item,
      baseVersion: 0,
    });
  }
  await appendOutbox(db, batchId, {
    entityType: 'payment',
    entityId: payment.id,
    operation: 'create',
    payload: payment,
    baseVersion: 0,
  });
}

async function nextOrderNumber(db: SQLiteDatabase): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = startOfDay.getTime();
  const row = await db.getFirstAsync<{ next: number }>(
    `SELECT COALESCE(MAX(order_number), 0) + 1 AS next
       FROM orders
      WHERE created_at >= ?`,
    [since]
  );
  return row?.next ?? 1;
}
