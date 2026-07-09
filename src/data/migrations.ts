import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Each migration runs once, in order. SQLite `PRAGMA user_version` tracks
 * the highest applied migration. Migrations are written so they can be re-run
 * safely (idempotent CREATE IF NOT EXISTS, etc.).
 */
export const MIGRATIONS: { version: number; up: (db: SQLiteDatabase) => Promise<void> }[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_cursors (
          entity TEXT PRIMARY KEY,
          cursor TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_outbox (
          outbox_id      INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id       TEXT    NOT NULL,
          entity_type    TEXT    NOT NULL,
          entity_id      TEXT    NOT NULL,
          operation      TEXT    NOT NULL CHECK (operation IN ('create','update','delete')),
          payload        TEXT    NOT NULL,
          base_version   INTEGER NOT NULL,
          idempotency_key TEXT   NOT NULL UNIQUE,
          attempts       INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL,
          last_error     TEXT,
          created_at     INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_ready ON sync_outbox(next_attempt_at, attempts);
        CREATE INDEX IF NOT EXISTS idx_outbox_batch ON sync_outbox(batch_id);

        CREATE TABLE IF NOT EXISTS categories (
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
        CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          category_id TEXT NOT NULL REFERENCES categories(id),
          name TEXT NOT NULL,
          description TEXT,
          base_price_cents INTEGER NOT NULL,
          image_url TEXT,
          sku TEXT,
          available INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
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
        CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          order_number INTEGER,
          channel TEXT NOT NULL DEFAULT 'DINE_IN',
          table_id TEXT,
          customer_id TEXT,
          opened_by_id TEXT,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          subtotal_cents INTEGER NOT NULL DEFAULT 0,
          discount_cents INTEGER NOT NULL DEFAULT 0,
          tax_cents INTEGER NOT NULL DEFAULT 0,
          service_charge_cents INTEGER NOT NULL DEFAULT 0,
          tip_cents INTEGER NOT NULL DEFAULT 0,
          grand_total_cents INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          kitchen_notes TEXT,
          submitted_at INTEGER,
          closed_at INTEGER,
          voided_at INTEGER,
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
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);

        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id TEXT NOT NULL,
          variant_id TEXT,
          name_snapshot TEXT NOT NULL,
          unit_price_cents INTEGER NOT NULL,
          quantity REAL NOT NULL,
          modifiers_json TEXT NOT NULL DEFAULT '[]',
          notes TEXT,
          line_subtotal_cents INTEGER NOT NULL,
          line_tax_cents INTEGER NOT NULL DEFAULT 0,
          voided INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);

        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          order_id TEXT NOT NULL REFERENCES orders(id),
          method TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          tendered_cents INTEGER,
          change_cents INTEGER,
          reference TEXT,
          status TEXT NOT NULL DEFAULT 'CAPTURED',
          captured_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          server_version INTEGER NOT NULL DEFAULT 0,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_error TEXT,
          last_synced_at INTEGER,
          device_id TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pay_order ON payments(order_id);
      `);
    },
  },
  {
    version: 2,
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS restaurant_tables (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          name TEXT NOT NULL,
          seats INTEGER NOT NULL DEFAULT 0,
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
        CREATE INDEX IF NOT EXISTS idx_tables_sort ON restaurant_tables(sort_order);
      `);
    },
  },
  {
    version: 3,
    up: async (db) => {
      // Kitchen workflow columns on orders. 'NONE' means the order never went
      // through the kitchen (e.g. takeaway paid up-front). 'NEW' is in the
      // queue, 'READY' is plated, 'SERVED' is bumped off the KDS.
      await db.execAsync(`
        ALTER TABLE orders ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'NONE';
        ALTER TABLE orders ADD COLUMN kitchen_ready_at INTEGER;
        CREATE INDEX IF NOT EXISTS idx_orders_kitchen ON orders(kitchen_status, created_at ASC);
      `);
    },
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  const latest = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
  if (current >= latest) return;

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await m.up(db);
    // PRAGMA user_version doesn't support bound parameters
    await db.execAsync(`PRAGMA user_version = ${m.version}`);
  }
}
