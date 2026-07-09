import type { SQLiteDatabase } from 'expo-sqlite';

import { DEMO_DEVICE_ID, DEMO_LOCATION_ID, DEMO_TENANT_ID } from '@/lib/constants';
import { uuidv7 } from '@/lib/uuid';

import type { CategoryRow, ProductRow } from '../schema';

export async function listCategories(db: SQLiteDatabase): Promise<CategoryRow[]> {
  return db.getAllAsync<CategoryRow>(
    `SELECT * FROM categories
      WHERE deleted_at IS NULL AND active = 1
      ORDER BY sort_order ASC, name ASC`
  );
}

export async function listProductsByCategory(
  db: SQLiteDatabase,
  categoryId: string | null
): Promise<ProductRow[]> {
  if (categoryId === null) {
    return db.getAllAsync<ProductRow>(
      `SELECT * FROM products
        WHERE deleted_at IS NULL AND available = 1
        ORDER BY sort_order ASC, name ASC`
    );
  }
  return db.getAllAsync<ProductRow>(
    `SELECT * FROM products
      WHERE category_id = ? AND deleted_at IS NULL AND available = 1
      ORDER BY sort_order ASC, name ASC`,
    [categoryId]
  );
}

export async function searchProducts(
  db: SQLiteDatabase,
  query: string
): Promise<ProductRow[]> {
  const like = `%${query.trim()}%`;
  return db.getAllAsync<ProductRow>(
    `SELECT * FROM products
      WHERE deleted_at IS NULL AND available = 1 AND name LIKE ?
      ORDER BY name ASC
      LIMIT 50`,
    [like]
  );
}

// ─────────────────────────── category CRUD ────────────────────────────

export async function createCategory(
  db: SQLiteDatabase,
  input: { name: string; color?: string | null }
): Promise<CategoryRow> {
  const id = uuidv7();
  const now = Date.now();
  const last = await db.getFirstAsync<{ max: number | null }>(
    `SELECT MAX(sort_order) AS max FROM categories WHERE deleted_at IS NULL`
  );
  const sortOrder = (last?.max ?? -1) + 1;
  const row: CategoryRow = {
    id,
    tenant_id: DEMO_TENANT_ID,
    location_id: DEMO_LOCATION_ID,
    name: input.name.trim(),
    color: input.color ?? null,
    icon: null,
    sort_order: sortOrder,
    active: 1,
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
  await db.runAsync(
    `INSERT INTO categories
      (id, tenant_id, location_id, name, color, icon, sort_order, active,
       version, server_version, sync_status, sync_error, last_synced_at,
       created_at, updated_at, deleted_at, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.tenant_id,
      row.location_id,
      row.name,
      row.color,
      row.icon,
      row.sort_order,
      row.active,
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
  return row;
}

export async function renameCategory(
  db: SQLiteDatabase,
  id: string,
  name: string
): Promise<void> {
  await db.runAsync(
    `UPDATE categories
        SET name = ?, updated_at = ?, version = version + 1, sync_status = 'pending'
      WHERE id = ?`,
    [name.trim(), Date.now(), id]
  );
}

export async function deleteCategory(db: SQLiteDatabase, id: string): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE categories
          SET deleted_at = ?, active = 0, updated_at = ?, version = version + 1, sync_status = 'pending'
        WHERE id = ?`,
      [now, now, id]
    );
    // Soft-delete contained products so the menu screen and POS stay consistent.
    await db.runAsync(
      `UPDATE products
          SET deleted_at = ?, available = 0, updated_at = ?, version = version + 1, sync_status = 'pending'
        WHERE category_id = ? AND deleted_at IS NULL`,
      [now, now, id]
    );
  });
}

// ─────────────────────────── product CRUD ─────────────────────────────

export async function createProduct(
  db: SQLiteDatabase,
  input: { categoryId: string; name: string; basePriceCents: number }
): Promise<ProductRow> {
  const id = uuidv7();
  const now = Date.now();
  const last = await db.getFirstAsync<{ max: number | null }>(
    `SELECT MAX(sort_order) AS max FROM products
      WHERE category_id = ? AND deleted_at IS NULL`,
    [input.categoryId]
  );
  const sortOrder = (last?.max ?? -1) + 1;
  const row: ProductRow = {
    id,
    tenant_id: DEMO_TENANT_ID,
    location_id: DEMO_LOCATION_ID,
    category_id: input.categoryId,
    name: input.name.trim(),
    description: null,
    base_price_cents: input.basePriceCents,
    image_url: null,
    sku: null,
    available: 1,
    sort_order: sortOrder,
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
  await db.runAsync(
    `INSERT INTO products
      (id, tenant_id, location_id, category_id, name, description,
       base_price_cents, image_url, sku, available, sort_order,
       version, server_version, sync_status, sync_error, last_synced_at,
       created_at, updated_at, deleted_at, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.tenant_id,
      row.location_id,
      row.category_id,
      row.name,
      row.description,
      row.base_price_cents,
      row.image_url,
      row.sku,
      row.available,
      row.sort_order,
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
  return row;
}

export async function updateProduct(
  db: SQLiteDatabase,
  id: string,
  input: { name?: string; basePriceCents?: number }
): Promise<void> {
  const fields: string[] = [];
  const args: (string | number)[] = [];
  if (input.name !== undefined) {
    fields.push('name = ?');
    args.push(input.name.trim());
  }
  if (input.basePriceCents !== undefined) {
    fields.push('base_price_cents = ?');
    args.push(input.basePriceCents);
  }
  if (fields.length === 0) return;
  fields.push("updated_at = ?", 'version = version + 1', "sync_status = 'pending'");
  args.push(Date.now(), id);
  await db.runAsync(
    `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
    args
  );
}

export async function deleteProduct(db: SQLiteDatabase, id: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `UPDATE products
        SET deleted_at = ?, available = 0, updated_at = ?, version = version + 1, sync_status = 'pending'
      WHERE id = ?`,
    [now, now, id]
  );
}

export async function listAllProducts(db: SQLiteDatabase): Promise<ProductRow[]> {
  return db.getAllAsync<ProductRow>(
    `SELECT * FROM products
      WHERE deleted_at IS NULL
      ORDER BY category_id ASC, sort_order ASC, name ASC`
  );
}
