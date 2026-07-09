import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { listOpenOrdersForTable, type KitchenOrder } from '@/data/repos/orders';

export interface UseOpenTicketsResult {
  data: KitchenOrder[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Lists open (SUBMITTED / PARTIALLY_PAID) orders for a given table.
 * `tableId === null` short-circuits — used for takeaway entrypoints.
 */
export function useOpenTickets(tableId: string | null): UseOpenTicketsResult {
  const db = useSQLiteContext();
  const [data, setData] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(tableId !== null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!tableId) {
      setData([]);
      setLoading(false);
      return;
    }
    const rows = await listOpenOrdersForTable(db, tableId);
    if (mountedRef.current) {
      setData(rows);
      setLoading(false);
    }
  }, [db, tableId]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return { data, loading, refresh };
}
