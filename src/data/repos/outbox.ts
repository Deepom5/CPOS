import type { SQLiteDatabase } from 'expo-sqlite';

import { uuidv4 } from '@/lib/uuid';
import type { OutboxRow } from '../schema';

export interface OutboxOp {
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  baseVersion: number;
}

/**
 * Append an op to the outbox. MUST be called inside the same transaction as
 * the domain write so we never have a state mutation without a sync entry.
 */
export async function appendOutbox(
  db: SQLiteDatabase,
  batchId: string,
  op: OutboxOp
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sync_outbox
      (batch_id, entity_type, entity_id, operation, payload, base_version,
       idempotency_key, attempts, next_attempt_at, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)`,
    [
      batchId,
      op.entityType,
      op.entityId,
      op.operation,
      JSON.stringify(op.payload),
      op.baseVersion,
      uuidv4(),
      now,
      now,
    ]
  );
}

export async function listReadyBatches(db: SQLiteDatabase, now: number, limit = 5): Promise<
  Map<string, OutboxRow[]>
> {
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM sync_outbox
     WHERE next_attempt_at <= ?
     ORDER BY created_at ASC, outbox_id ASC
     LIMIT ?`,
    [now, limit * 20]
  );
  const byBatch = new Map<string, OutboxRow[]>();
  for (const r of rows) {
    const list = byBatch.get(r.batch_id) ?? [];
    list.push(r);
    byBatch.set(r.batch_id, list);
    if (byBatch.size >= limit) break;
  }
  return byBatch;
}

export async function markBatchSynced(db: SQLiteDatabase, batchId: string): Promise<void> {
  await db.runAsync('DELETE FROM sync_outbox WHERE batch_id = ?', [batchId]);
}

export async function markBatchFailed(
  db: SQLiteDatabase,
  batchId: string,
  error: string,
  delayMs: number
): Promise<void> {
  const next = Date.now() + delayMs;
  await db.runAsync(
    `UPDATE sync_outbox
        SET attempts = attempts + 1,
            next_attempt_at = ?,
            last_error = ?
      WHERE batch_id = ?`,
    [next, error, batchId]
  );
}

export async function countPending(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sync_outbox');
  return row?.c ?? 0;
}
