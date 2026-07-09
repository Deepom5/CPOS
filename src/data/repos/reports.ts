import type { SQLiteDatabase } from 'expo-sqlite';

import { DEMO_LOCATION_ID, DEMO_TENANT_ID } from '@/lib/constants';

import type { OrderRow, PaymentMethod } from '../schema';

/** Start-of-day epoch ms for the device-local day. */
function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface DashboardStats {
  todaySalesCents: number;
  todayOrderCount: number;
  todayAverageOrderCents: number;
}

export async function getDashboardStats(db: SQLiteDatabase): Promise<DashboardStats> {
  const since = startOfTodayMs();
  const row = await db.getFirstAsync<{
    total: number | null;
    count: number | null;
  }>(
    `SELECT
       COALESCE(SUM(grand_total_cents), 0) AS total,
       COUNT(*) AS count
     FROM orders
     WHERE tenant_id = ? AND location_id = ?
       AND status = 'PAID'
       AND deleted_at IS NULL
       AND created_at >= ?`,
    [DEMO_TENANT_ID, DEMO_LOCATION_ID, since]
  );
  const total = row?.total ?? 0;
  const count = row?.count ?? 0;
  const avg = count > 0 ? Math.round(total / count) : 0;
  return {
    todaySalesCents: total,
    todayOrderCount: count,
    todayAverageOrderCents: avg,
  };
}

export interface PaidOrderListItem {
  order: OrderRow;
  method: PaymentMethod | null;
}

export async function listPaidOrdersSince(
  db: SQLiteDatabase,
  sinceMs: number,
  limit = 100
): Promise<PaidOrderListItem[]> {
  const rows = await db.getAllAsync<OrderRow & { method: PaymentMethod | null }>(
    `SELECT o.*, (SELECT method FROM payments p WHERE p.order_id = o.id
                   ORDER BY captured_at DESC LIMIT 1) AS method
       FROM orders o
      WHERE o.tenant_id = ? AND o.location_id = ?
        AND o.status = 'PAID'
        AND o.deleted_at IS NULL
        AND o.created_at >= ?
      ORDER BY o.created_at DESC
      LIMIT ?`,
    [DEMO_TENANT_ID, DEMO_LOCATION_ID, sinceMs, limit]
  );
  return rows.map((r) => {
    const { method, ...orderRow } = r;
    return { order: orderRow as OrderRow, method };
  });
}

export interface MethodBreakdown {
  method: PaymentMethod;
  totalCents: number;
  orderCount: number;
}

export async function getTodaysMethodBreakdown(
  db: SQLiteDatabase
): Promise<MethodBreakdown[]> {
  const since = startOfTodayMs();
  const rows = await db.getAllAsync<{
    method: PaymentMethod;
    total: number;
    count: number;
  }>(
    `SELECT p.method AS method,
            COALESCE(SUM(p.amount_cents), 0) AS total,
            COUNT(*) AS count
       FROM payments p
       JOIN orders o ON o.id = p.order_id
      WHERE o.tenant_id = ? AND o.location_id = ?
        AND o.status = 'PAID'
        AND o.deleted_at IS NULL
        AND o.created_at >= ?
        AND p.status = 'CAPTURED'
      GROUP BY p.method
      ORDER BY total DESC`,
    [DEMO_TENANT_ID, DEMO_LOCATION_ID, since]
  );
  return rows.map((r) => ({
    method: r.method,
    totalCents: r.total,
    orderCount: r.count,
  }));
}

export function startOfToday(): number {
  return startOfTodayMs();
}
