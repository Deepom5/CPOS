import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
    listOpenKitchenOrders,
    markKitchenStatus,
    type KitchenOrder,
} from '@/data/repos/orders';
import type { KitchenStatus } from '@/data/schema';

export interface UseKitchenOrdersResult {
  data: KitchenOrder[];
  loading: boolean;
  refresh: () => Promise<void>;
  mark: (orderId: string, status: Exclude<KitchenStatus, 'NONE'>) => Promise<void>;
}

/**
 * Polls the open kitchen queue every few seconds. Polling is fine for v1; the
 * sync engine can later replace this with a push subscription.
 */
export function useKitchenOrders(pollMs = 4000): UseKitchenOrdersResult {
  const db = useSQLiteContext();
  const [data, setData] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const rows = await listOpenKitchenOrders(db);
    if (mountedRef.current) {
      setData(rows);
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh, pollMs]);

  const mark = useCallback(
    async (orderId: string, status: Exclude<KitchenStatus, 'NONE'>) => {
      await markKitchenStatus(db, orderId, status);
      await refresh();
    },
    [db, refresh]
  );

  return { data, loading, refresh, mark };
}
