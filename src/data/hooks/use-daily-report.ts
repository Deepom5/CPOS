import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import {
    getTodaysMethodBreakdown,
    listPaidOrdersSince,
    startOfToday,
    type MethodBreakdown,
    type PaidOrderListItem,
} from '@/data/repos/reports';

export interface UseDailyReportResult {
  orders: PaidOrderListItem[];
  breakdown: MethodBreakdown[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useDailyReport(): UseDailyReportResult {
  const db = useSQLiteContext();
  const [orders, setOrders] = useState<PaidOrderListItem[]>([]);
  const [breakdown, setBreakdown] = useState<MethodBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const since = startOfToday();
    const [list, methods] = await Promise.all([
      listPaidOrdersSince(db, since),
      getTodaysMethodBreakdown(db),
    ]);
    setOrders(list);
    setBreakdown(methods);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { orders, breakdown, loading, refresh };
}
