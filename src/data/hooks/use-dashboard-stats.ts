import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getDashboardStats, type DashboardStats } from '@/data/repos/reports';

export interface UseDashboardStatsResult {
  stats: DashboardStats;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_STATS: DashboardStats = {
  todaySalesCents: 0,
  todayOrderCount: 0,
  todayAverageOrderCents: 0,
};

export function useDashboardStats(): UseDashboardStatsResult {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getDashboardStats(db);
    setStats(next);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}
