# 03 — Database Schema

Two schemas, designed to mirror each other where it matters.

- **Cloud**: PostgreSQL via Prisma. Source of truth for cross-device state.
- **Local**: SQLite via `expo-sqlite`. Source of truth for one device during offline operation.

## 3.1 Cloud — Prisma schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────────────
// Tenancy
// ─────────────────────────────────────────────────────────────
model Tenant {
  id          String   @id @default(uuid()) @db.Uuid
  name        String
  slug        String   @unique
  plan        String   @default("starter")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  locations   Location[]
  employees   Employee[]
  customers   Customer[]
  menuTemplates MenuTemplate[]

  @@index([deletedAt])
}

model Location {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid
  name         String
  timezone     String
  currency     String   @default("USD")
  address      Json?
  receiptHeader String?
  receiptFooter String?
  taxInclusive Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  devices      Device[]
  categories   Category[]
  products     Product[]
  taxes        Tax[]
  tables       RestaurantTable[]
  orders       Order[]
  inventoryItems InventoryItem[]
  inventoryEvents InventoryEvent[]
  employeeLocations EmployeeLocation[]

  @@unique([tenantId, name])
  @@index([tenantId, deletedAt])
}

model Device {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid
  locationId    String   @db.Uuid
  name          String
  role          DeviceRole @default(POS)
  platform      String
  osVersion     String?
  appVersion    String
  lastSeenAt    DateTime?
  pushToken     String?
  registeredAt  DateTime @default(now())
  revokedAt     DateTime?

  location      Location @relation(fields: [locationId], references: [id])

  @@index([tenantId, locationId])
}

enum DeviceRole { POS KDS ADMIN }

// ─────────────────────────────────────────────────────────────
// Auth & RBAC
// ─────────────────────────────────────────────────────────────
model Employee {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid
  email         String?
  phone         String?
  name          String
  pinHash       String   // argon2id; PIN is 4-8 digits
  passwordHash  String?  // optional, only owners/managers
  role          Role
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  locations     EmployeeLocation[]
  shifts        Shift[]
  ordersOpened  Order[]  @relation("OrderOpenedBy")

  @@unique([tenantId, email])
  @@index([tenantId, deletedAt])
}

enum Role { OWNER MANAGER CASHIER KITCHEN INVENTORY ACCOUNTANT }

model EmployeeLocation {
  employeeId String @db.Uuid
  locationId String @db.Uuid
  employee   Employee @relation(fields: [employeeId], references: [id])
  location   Location @relation(fields: [locationId], references: [id])
  @@id([employeeId, locationId])
}

model Shift {
  id          String   @id @default(uuid()) @db.Uuid
  employeeId  String   @db.Uuid
  locationId  String   @db.Uuid
  clockInAt   DateTime
  clockOutAt  DateTime?
  cashStart   Decimal? @db.Decimal(12, 2)
  cashEnd     Decimal? @db.Decimal(12, 2)
  notes       String?

  employee    Employee @relation(fields: [employeeId], references: [id])

  @@index([locationId, clockInAt])
}

// ─────────────────────────────────────────────────────────────
// Menu
// ─────────────────────────────────────────────────────────────
model MenuTemplate {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  name      String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
}

model Category {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  locationId  String   @db.Uuid
  name        String
  color       String?
  icon        String?
  sortOrder   Int      @default(0)
  active      Boolean  @default(true)
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  location    Location  @relation(fields: [locationId], references: [id])
  products    Product[]

  @@index([locationId, sortOrder])
}

model Product {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  locationId  String   @db.Uuid
  categoryId  String   @db.Uuid
  name        String
  description String?
  basePrice   Decimal  @db.Decimal(12, 2)
  imageUrl    String?
  sku         String?
  trackInventory Boolean @default(false)
  available   Boolean  @default(true)
  sortOrder   Int      @default(0)
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  category    Category @relation(fields: [categoryId], references: [id])
  location    Location @relation(fields: [locationId], references: [id])
  variants    ProductVariant[]
  addOns      ProductAddOn[]
  taxes       ProductTax[]
  inventoryLinks ProductInventoryLink[]

  @@index([locationId, categoryId, sortOrder])
  @@index([tenantId, sku])
}

model ProductVariant {
  id         String   @id @default(uuid()) @db.Uuid
  productId  String   @db.Uuid
  name       String   // "Small", "Medium", "Large"
  priceDelta Decimal  @db.Decimal(12, 2) @default(0)
  sortOrder  Int      @default(0)
  active     Boolean  @default(true)
  version    Int      @default(1)

  product    Product  @relation(fields: [productId], references: [id])
}

model AddOnGroup {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  locationId String  @db.Uuid
  name      String   // "Milk options", "Syrups"
  minSelect Int      @default(0)
  maxSelect Int      @default(1)
  addOns    AddOn[]
  productLinks ProductAddOn[]
}

model AddOn {
  id          String   @id @default(uuid()) @db.Uuid
  groupId     String   @db.Uuid
  name        String
  priceDelta  Decimal  @db.Decimal(12, 2) @default(0)
  sortOrder   Int      @default(0)
  active      Boolean  @default(true)

  group       AddOnGroup @relation(fields: [groupId], references: [id])
}

model ProductAddOn {
  productId String @db.Uuid
  groupId   String @db.Uuid
  required  Boolean @default(false)
  product   Product    @relation(fields: [productId], references: [id])
  group     AddOnGroup @relation(fields: [groupId], references: [id])
  @@id([productId, groupId])
}

model Tax {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  locationId  String   @db.Uuid
  name        String   // "GST 5%", "VAT 20%"
  rate        Decimal  @db.Decimal(6, 4) // 0.0500
  inclusive   Boolean  @default(false)
  location    Location @relation(fields: [locationId], references: [id])
}

model ProductTax {
  productId String @db.Uuid
  taxId     String @db.Uuid
  product   Product @relation(fields: [productId], references: [id])
  tax       Tax     @relation(fields: [taxId], references: [id])
  @@id([productId, taxId])
}

// ─────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────
model RestaurantTable {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid
  locationId  String   @db.Uuid
  label       String   // "T1", "Bar 3"
  seats       Int      @default(2)
  shape       String   @default("round") // round | square | rect
  x           Int      // floor plan coords
  y           Int
  w           Int
  h           Int
  status      TableStatus @default(AVAILABLE)
  mergedWithId String? @db.Uuid
  version     Int      @default(1)
  updatedAt   DateTime @updatedAt
  location    Location @relation(fields: [locationId], references: [id])
  @@unique([locationId, label])
}

enum TableStatus { AVAILABLE OCCUPIED RESERVED CLEANING OUT_OF_SERVICE }

// ─────────────────────────────────────────────────────────────
// Orders & Payments
// ─────────────────────────────────────────────────────────────
model Order {
  id            String   @id @db.Uuid // client-generated uuid v7
  tenantId      String   @db.Uuid
  locationId    String   @db.Uuid
  orderNumber   Int      // per-location daily-resetting sequence
  channel       OrderChannel @default(DINE_IN)
  tableId       String?  @db.Uuid
  customerId    String?  @db.Uuid
  openedById    String?  @db.Uuid
  status        OrderStatus @default(DRAFT)
  subtotal      Decimal  @db.Decimal(12, 2)
  discountTotal Decimal  @db.Decimal(12, 2) @default(0)
  taxTotal      Decimal  @db.Decimal(12, 2) @default(0)
  serviceCharge Decimal  @db.Decimal(12, 2) @default(0)
  tipTotal      Decimal  @db.Decimal(12, 2) @default(0)
  grandTotal    Decimal  @db.Decimal(12, 2)
  notes         String?
  kitchenNotes  String?
  version       Int      @default(1)
  submittedAt   DateTime?
  closedAt      DateTime?
  voidedAt      DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deviceId      String   @db.Uuid

  location      Location @relation(fields: [locationId], references: [id])
  openedBy      Employee? @relation("OrderOpenedBy", fields: [openedById], references: [id])
  items         OrderItem[]
  payments      Payment[]
  discounts     OrderDiscount[]

  @@unique([locationId, orderNumber])
  @@index([locationId, status, createdAt])
  @@index([tenantId, createdAt])
}

enum OrderChannel { DINE_IN TAKEAWAY DELIVERY ONLINE }
enum OrderStatus  { DRAFT HELD SUBMITTED PARTIALLY_PAID PAID REFUNDED VOIDED }

model OrderItem {
  id           String   @id @db.Uuid
  orderId      String   @db.Uuid
  productId    String   @db.Uuid
  variantId    String?  @db.Uuid
  nameSnapshot String   // captured at order time
  unitPrice    Decimal  @db.Decimal(12, 2)
  quantity     Decimal  @db.Decimal(10, 3) // supports 0.5 kg sales
  modifiers    Json     // [{addOnId, name, priceDelta}]
  notes        String?
  lineSubtotal Decimal  @db.Decimal(12, 2)
  lineTaxTotal Decimal  @db.Decimal(12, 2)
  kdsStatus    KdsStatus @default(NEW)
  voided       Boolean  @default(false)

  order        Order    @relation(fields: [orderId], references: [id])
  @@index([orderId])
}

enum KdsStatus { NEW PREPARING READY SERVED CANCELLED }

model OrderDiscount {
  id        String @id @db.Uuid
  orderId   String @db.Uuid
  type      String // "percent" | "fixed" | "coupon"
  value     Decimal @db.Decimal(12, 4)
  reason    String?
  appliedBy String? @db.Uuid
  order     Order  @relation(fields: [orderId], references: [id])
}

model Payment {
  id           String   @id @db.Uuid
  tenantId     String   @db.Uuid
  locationId   String   @db.Uuid
  orderId      String   @db.Uuid
  method       PaymentMethod
  amount       Decimal  @db.Decimal(12, 2) // negative for refunds
  tendered     Decimal? @db.Decimal(12, 2) // cash tendered
  change       Decimal? @db.Decimal(12, 2)
  reference    String?  // gateway txn id, last 4, UPI ref
  status       PaymentStatus @default(CAPTURED)
  capturedAt   DateTime
  createdAt    DateTime @default(now())

  order        Order    @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@index([locationId, capturedAt])
}

enum PaymentMethod { CASH CARD UPI WALLET BANK_TRANSFER OTHER }
enum PaymentStatus { PENDING CAPTURED FAILED REFUNDED }

// ─────────────────────────────────────────────────────────────
// Customers & Loyalty
// ─────────────────────────────────────────────────────────────
model Customer {
  id          String   @id @db.Uuid
  tenantId    String   @db.Uuid
  name        String?
  phone       String?
  email       String?
  notes       String?
  loyaltyPoints Int    @default(0)
  favoriteProductIds Json @default("[]")
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  tenant      Tenant @relation(fields: [tenantId], references: [id])
  loyalty     LoyaltyTransaction[]

  @@unique([tenantId, phone])
  @@index([tenantId, name])
}

model LoyaltyTransaction {
  id          String   @id @db.Uuid
  customerId  String   @db.Uuid
  orderId     String?  @db.Uuid
  delta       Int      // +earned or -redeemed
  reason      String
  createdAt   DateTime @default(now())
  customer    Customer @relation(fields: [customerId], references: [id])
  @@index([customerId, createdAt])
}

// ─────────────────────────────────────────────────────────────
// Inventory (event-sourced)
// ─────────────────────────────────────────────────────────────
model InventoryItem {
  id          String   @id @db.Uuid
  tenantId    String   @db.Uuid
  locationId  String   @db.Uuid
  name        String
  unit        String   // "g", "ml", "ea", "kg"
  lowStockThreshold Decimal? @db.Decimal(14, 4)
  active      Boolean  @default(true)
  // current stock is a PROJECTION (materialized) — see worker
  currentStock Decimal @db.Decimal(14, 4) @default(0)
  version     Int      @default(1)
  updatedAt   DateTime @updatedAt
  location    Location @relation(fields: [locationId], references: [id])
  events      InventoryEvent[]
  productLinks ProductInventoryLink[]
}

model InventoryEvent {
  id          String   @id @db.Uuid
  tenantId    String   @db.Uuid
  locationId  String   @db.Uuid
  itemId      String   @db.Uuid
  type        InventoryEventType
  quantity    Decimal  @db.Decimal(14, 4) // signed
  reason      String?
  orderId     String?  @db.Uuid
  employeeId  String?  @db.Uuid
  vendorId    String?  @db.Uuid
  occurredAt  DateTime
  createdAt   DateTime @default(now())

  item        InventoryItem @relation(fields: [itemId], references: [id])
  location    Location      @relation(fields: [locationId], references: [id])

  @@index([itemId, occurredAt])
  @@index([locationId, occurredAt])
}

enum InventoryEventType { RECEIVED CONSUMED ADJUSTED WASTED TRANSFER_IN TRANSFER_OUT OPENING_BALANCE }

model ProductInventoryLink {
  productId    String @db.Uuid
  inventoryItemId String @db.Uuid
  quantityPerUnit Decimal @db.Decimal(14, 4)
  product       Product       @relation(fields: [productId], references: [id])
  inventoryItem InventoryItem @relation(fields: [inventoryItemId], references: [id])
  @@id([productId, inventoryItemId])
}

model Vendor {
  id        String   @id @db.Uuid
  tenantId  String   @db.Uuid
  name      String
  phone     String?
  email     String?
  notes     String?
}

model PurchaseOrder {
  id         String   @id @db.Uuid
  tenantId   String   @db.Uuid
  locationId String   @db.Uuid
  vendorId   String   @db.Uuid
  number     String
  status     String   @default("draft") // draft | sent | received | cancelled
  total      Decimal  @db.Decimal(14, 2)
  expectedAt DateTime?
  receivedAt DateTime?
  items      Json     // [{itemId, qty, unitCost}]
  createdAt  DateTime @default(now())
}

// ─────────────────────────────────────────────────────────────
// Sync, Idempotency, Audit
// ─────────────────────────────────────────────────────────────
model SyncCursor {
  deviceId   String
  entity     String
  cursor     String
  updatedAt  DateTime @updatedAt
  @@id([deviceId, entity])
}

model IdempotencyKey {
  key        String   @id
  tenantId   String   @db.Uuid
  endpoint   String
  responseJson Json
  createdAt  DateTime @default(now())
  expiresAt  DateTime
  @@index([expiresAt])
}

model AuditLog {
  id         BigInt   @id @default(autoincrement())
  tenantId   String   @db.Uuid
  actorType  String   // 'employee' | 'system'
  actorId    String?
  action     String   // 'order.void', 'inventory.adjust'
  entity     String
  entityId   String
  before     Json?
  after      Json?
  ip         String?
  deviceId   String?
  createdAt  DateTime @default(now())
  @@index([tenantId, createdAt])
  @@index([entity, entityId])
}
```

### Indexing strategy (PostgreSQL)

- Every multi-tenant lookup index starts with `tenant_id` then `location_id`.
- Hot read paths: `Order(location_id, status, createdAt DESC)`, `Payment(location_id, capturedAt DESC)`, `InventoryEvent(item_id, occurredAt DESC)`.
- Reporting uses **materialized views** refreshed by workers: `mv_daily_sales`, `mv_top_items`, `mv_payment_breakdown`, `mv_staff_sales`.
- Soft-delete partial indexes: `WHERE deleted_at IS NULL` on `Product`, `Category`, `Customer`, `Employee`.
- `Order.orderNumber` is generated by a per-location daily sequence (`gen_order_number(location_id, day)`) inside a transaction.

### Row-Level Security (optional, recommended)

Enable RLS on every tenant-scoped table:

```sql
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Order"
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

The API sets `SET LOCAL app.tenant_id = $1` at the start of every request transaction.

## 3.2 Local — SQLite schema

The mobile DB mirrors the operational subset of the cloud schema with sync metadata added to every row. SQL below is the migration shipped with the app.

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- meta keys: schema_version, device_id, tenant_id, location_id,
-- last_full_pull_at, app_session

CREATE TABLE sync_cursors (
  entity TEXT PRIMARY KEY,
  cursor TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sync_outbox (
  outbox_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id       TEXT    NOT NULL,
  entity_type    TEXT    NOT NULL,
  entity_id      TEXT    NOT NULL,
  operation      TEXT    NOT NULL CHECK (operation IN ('create','update','delete')),
  payload        TEXT    NOT NULL,        -- JSON
  base_version   INTEGER NOT NULL,
  idempotency_key TEXT   NOT NULL UNIQUE,
  attempts       INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_error     TEXT,
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_outbox_ready ON sync_outbox(next_attempt_at, attempts);
CREATE INDEX idx_outbox_batch ON sync_outbox(batch_id);

CREATE TABLE conflicts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  local_snapshot TEXT NOT NULL,
  server_snapshot TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  resolved_at   INTEGER
);

-- ─────────────── Sync columns helper ───────────────
-- Every domain table below has these 9 columns:
--   version INTEGER NOT NULL DEFAULT 1,
--   server_version INTEGER NOT NULL DEFAULT 0,
--   sync_status TEXT NOT NULL DEFAULT 'pending',
--   sync_error TEXT,
--   last_synced_at INTEGER,
--   created_at INTEGER NOT NULL,
--   updated_at INTEGER NOT NULL,
--   deleted_at INTEGER,
--   device_id TEXT NOT NULL

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL
);
CREATE INDEX idx_categories_sort ON categories(sort_order) WHERE deleted_at IS NULL;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  base_price REAL NOT NULL,
  image_url TEXT,
  image_local_path TEXT,         -- cached file path
  sku TEXT,
  track_inventory INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  taxes_json TEXT NOT NULL DEFAULT '[]',
  -- ...sync cols
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL
);
CREATE INDEX idx_products_cat ON products(category_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_name ON products(name) WHERE deleted_at IS NULL;

CREATE TABLE variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  price_delta REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE addon_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_select INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE addons (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES addon_groups(id),
  name TEXT NOT NULL,
  price_delta REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE product_addons (
  product_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, group_id)
);

CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  label TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 2,
  shape TEXT NOT NULL DEFAULT 'round',
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  merged_with_id TEXT,
  -- sync cols...
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,                  -- uuid v7
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  order_number INTEGER,                 -- assigned on submit (local seq)
  channel TEXT NOT NULL DEFAULT 'DINE_IN',
  table_id TEXT,
  customer_id TEXT,
  opened_by_id TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  subtotal REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  service_charge REAL NOT NULL DEFAULT 0,
  tip_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  kitchen_notes TEXT,
  submitted_at INTEGER,
  closed_at INTEGER,
  voided_at INTEGER,
  -- sync cols
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL
);
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX idx_orders_table  ON orders(table_id) WHERE status NOT IN ('PAID','VOIDED','REFUNDED');

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL,
  variant_id TEXT,
  name_snapshot TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity REAL NOT NULL,
  modifiers_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  line_subtotal REAL NOT NULL,
  line_tax_total REAL NOT NULL DEFAULT 0,
  kds_status TEXT NOT NULL DEFAULT 'NEW',
  voided INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_oi_order ON order_items(order_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  method TEXT NOT NULL,
  amount REAL NOT NULL,
  tendered REAL,
  change_amt REAL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'CAPTURED',
  captured_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  -- payments are append-only; no update path
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  last_synced_at INTEGER,
  device_id TEXT NOT NULL
);
CREATE INDEX idx_pay_order ON payments(order_id);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  -- sync cols
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id TEXT NOT NULL
);
CREATE INDEX idx_customers_phone ON customers(phone) WHERE deleted_at IS NULL;

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  pin_hash TEXT NOT NULL,             -- argon2id; PIN check works offline
  active INTEGER NOT NULL DEFAULT 1,
  cached_token TEXT,                  -- encrypted refresh token blob
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  last_synced_at INTEGER
);

CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  clock_in_at INTEGER NOT NULL,
  clock_out_at INTEGER,
  cash_start REAL,
  cash_end REAL,
  notes TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  low_stock_threshold REAL,
  current_stock REAL NOT NULL DEFAULT 0, -- local projection
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  last_synced_at INTEGER
);

CREATE TABLE inventory_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES inventory_items(id),
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  reason TEXT,
  order_id TEXT,
  employee_id TEXT,
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX idx_inv_events_item ON inventory_events(item_id, occurred_at DESC);

-- Local-only operational tables (never synced)
CREATE TABLE print_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  kind TEXT NOT NULL,                -- 'receipt' | 'kitchen'
  payload TEXT NOT NULL,             -- rendered ESC/POS or PDF path
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Local indexing notes

- SQLite indexes are cheap; favor them on every column the UI sorts/filters by.
- The product list grid renders from `SELECT id,name,base_price,image_local_path FROM products WHERE category_id=? AND deleted_at IS NULL ORDER BY sort_order` — covered by `idx_products_cat`.
- Full-text search for customers/products uses an FTS5 virtual table: `customers_fts(name, phone, email)`.

## 3.3 Schema versioning & migrations

- **Cloud**: Prisma Migrate, one migration per PR, deployed before app code.
- **Local**: numeric `schema_version` in the `meta` table. Migrations live in `src/data/migrations/NNNN_*.ts` and are applied in order at app boot inside a single transaction. Downgrades are not supported; if the app version is older than the DB schema, the user is asked to update.

## 3.4 Money handling

- Cloud: `Decimal(12, 2)`.
- Local: SQLite has no decimal type. Use **integer minor units** (cents) at all computation points, convert at the UI edge. The schema above uses `REAL` for prototyping clarity; the implementation must use integer cents in production to avoid float drift.
