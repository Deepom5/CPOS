import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { listCategories, listProductsByCategory } from '@/data/repos/menu';
import type { CategoryRow, ProductRow } from '@/data/schema';

export function useCategories(): { data: CategoryRow[]; loading: boolean } {
  const db = useSQLiteContext();
  const [data, setData] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listCategories(db);
      if (!cancelled) {
        setData(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);
  return { data, loading };
}

export function useProducts(categoryId: string | null): {
  data: ProductRow[];
  loading: boolean;
} {
  const db = useSQLiteContext();
  const [data, setData] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const rows = await listProductsByCategory(db, categoryId);
      if (!cancelled) {
        setData(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, categoryId]);
  return { data, loading };
}
