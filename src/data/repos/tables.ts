import type { SQLiteDatabase } from 'expo-sqlite';

import { DEMO_DEVICE_ID, DEMO_LOCATION_ID, DEMO_TENANT_ID } from '@/lib/constants';
import { uuidv7 } from '@/lib/uuid';

import type { RestaurantTableRow } from '../schema';

export async function listTables(db: SQLiteDatabase): Promise<RestaurantTableRow[]> {
  return db.getAllAsync<RestaurantTableRow>(
    `SELECT * FROM restaurant_tables
      WHERE deleted_at IS NULL AND active = 1
      ORDER BY sort_order ASC, name ASC`
  );
}

export async function getTable(
  db: SQLiteDatabase,
  id: string
): Promise<RestaurantTableRow | null> {
  const row = await db.getFirstAsync<RestaurantTableRow>(
    `SELECT * FROM restaurant_tables WHERE id = ?`,
    [id]
  );
  return row ?? null;
}

export async function createTable(
  db: SQLiteDatabase,
  input: { name: string; seats?: number }
): Promise<RestaurantTableRow> {
  const id = uuidv7();
  const now = Date.now();
  const last = await db.getFirstAsync<{ max: number | null }>(
    `SELECT MAX(sort_order) AS max FROM restaurant_tables WHERE deleted_at IS NULL`
  );
  const sortOrder = (last?.max ?? -1) + 1;
  const row: RestaurantTableRow = {
    id,
    tenant_id: DEMO_TENANT_ID,
    location_id: DEMO_LOCATION_ID,
    name: input.name.trim(),
    seats: input.seats ?? 0,
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
    `INSERT INTO restaurant_tables
      (id, tenant_id, location_id, name, seats, sort_order, active,
       version, server_version, sync_status, sync_error, last_synced_at,
       created_at, updated_at, deleted_at, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.tenant_id,
      row.location_id,
      row.name,
      row.seats,
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

export async function renameTable(
  db: SQLiteDatabase,
  id: string,
  name: string
): Promise<void> {
  await db.runAsync(
    `UPDATE restaurant_tables
        SET name = ?, updated_at = ?, version = version + 1, sync_status = 'pending'
      WHERE id = ?`,
    [name.trim(), Date.now(), id]
  );
}

export async function deleteTable(db: SQLiteDatabase, id: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `UPDATE restaurant_tables
        SET deleted_at = ?, active = 0, updated_at = ?, version = version + 1, sync_status = 'pending'
      WHERE id = ?`,
    [now, now, id]
  );
}
