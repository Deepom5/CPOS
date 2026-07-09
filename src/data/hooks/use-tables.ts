import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { createTable, deleteTable, listTables, renameTable } from '@/data/repos/tables';
import type { RestaurantTableRow } from '@/data/schema';

export interface UseTablesResult {
  data: RestaurantTableRow[];
  loading: boolean;
  refresh: () => Promise<void>;
  addTable: (input: { name: string; seats?: number }) => Promise<RestaurantTableRow>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useTables(): UseTablesResult {
  const db = useSQLiteContext();
  const [data, setData] = useState<RestaurantTableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await listTables(db);
    setData(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addTable = useCallback(
    async (input: { name: string; seats?: number }) => {
      const row = await createTable(db, input);
      await refresh();
      return row;
    },
    [db, refresh]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameTable(db, id, name);
      await refresh();
    },
    [db, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTable(db, id);
      await refresh();
    },
    [db, refresh]
  );

  return { data, loading, refresh, addTable, rename, remove };
}
