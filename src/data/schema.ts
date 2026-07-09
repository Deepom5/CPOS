/**
 * Local SQLite schema types. These mirror the column shape of each table so
 * repositories return strongly-typed rows.
 *
 * Money columns are stored as INTEGER cents to avoid float drift.
 */

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface SyncMeta {
  version: number;
  server_version: number;
  sync_status: SyncStatus;
  sync_error: string | null;
  last_synced_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  device_id: string;
}

export interface CategoryRow extends SyncMeta {
  id: string;
  tenant_id: string;
  location_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  active: number; // 0/1
}

export interface ProductRow extends SyncMeta {
  id: string;
  tenant_id: string;
  location_id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price_cents: number;
  image_url: string | null;
  sku: string | null;
  available: number;
  sort_order: number;
}

export interface RestaurantTableRow extends SyncMeta {
  id: string;
  tenant_id: string;
  location_id: string;
  name: string;
  seats: number;
  sort_order: number;
  active: number; // 0/1
}

export type OrderStatus =
  | 'DRAFT'
  | 'HELD'
  | 'SUBMITTED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'REFUNDED'
  | 'VOIDED';

export type OrderChannel = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE';

export type KitchenStatus = 'NONE' | 'NEW' | 'READY' | 'SERVED';

export interface OrderRow extends SyncMeta {
  id: string;
  tenant_id: string;
  location_id: string;
  order_number: number | null;
  channel: OrderChannel;
  table_id: string | null;
  customer_id: string | null;
  opened_by_id: string | null;
  status: OrderStatus;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  service_charge_cents: number;
  tip_cents: number;
  grand_total_cents: number;
  notes: string | null;
  kitchen_notes: string | null;
  submitted_at: number | null;
  closed_at: number | null;
  voided_at: number | null;
  kitchen_status: KitchenStatus;
  kitchen_ready_at: number | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  name_snapshot: string;
  unit_price_cents: number;
  quantity: number;
  modifiers_json: string;
  notes: string | null;
  line_subtotal_cents: number;
  line_tax_cents: number;
  voided: number;
  created_at: number;
  updated_at: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'BANK_TRANSFER' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'CAPTURED' | 'FAILED' | 'REFUNDED';

export interface PaymentRow {
  id: string;
  tenant_id: string;
  location_id: string;
  order_id: string;
  method: PaymentMethod;
  amount_cents: number; // negative for refunds
  tendered_cents: number | null;
  change_cents: number | null;
  reference: string | null;
  status: PaymentStatus;
  captured_at: number;
  created_at: number;
  version: number;
  server_version: number;
  sync_status: SyncStatus;
  sync_error: string | null;
  last_synced_at: number | null;
  device_id: string;
}

export interface OutboxRow {
  outbox_id: number;
  batch_id: string;
  entity_type: string;
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  base_version: number;
  idempotency_key: string;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  created_at: number;
}
