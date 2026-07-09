import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import {
    createCategory,
    createProduct,
    deleteCategory,
    deleteProduct,
    listAllProducts,
    listCategories,
    renameCategory,
    updateProduct,
} from '@/data/repos/menu';
import type { CategoryRow, ProductRow } from '@/data/schema';

export interface UseMenuAdminResult {
  categories: CategoryRow[];
  products: ProductRow[];
  loading: boolean;
  refresh: () => Promise<void>;
  addCategory: (input: { name: string }) => Promise<CategoryRow>;
  renameCategoryById: (id: string, name: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addProduct: (input: {
    categoryId: string;
    name: string;
    basePriceCents: number;
  }) => Promise<ProductRow>;
  editProduct: (
    id: string,
    input: { name?: string; basePriceCents?: number }
  ) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
}

export function useMenuAdmin(): UseMenuAdminResult {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [cats, prods] = await Promise.all([listCategories(db), listAllProducts(db)]);
    setCategories(cats);
    setProducts(prods);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addCategory = useCallback(
    async (input: { name: string }) => {
      const row = await createCategory(db, input);
      await refresh();
      return row;
    },
    [db, refresh]
  );

  const renameCategoryById = useCallback(
    async (id: string, name: string) => {
      await renameCategory(db, id, name);
      await refresh();
    },
    [db, refresh]
  );

  const removeCategory = useCallback(
    async (id: string) => {
      await deleteCategory(db, id);
      await refresh();
    },
    [db, refresh]
  );

  const addProduct = useCallback(
    async (input: { categoryId: string; name: string; basePriceCents: number }) => {
      const row = await createProduct(db, input);
      await refresh();
      return row;
    },
    [db, refresh]
  );

  const editProduct = useCallback(
    async (id: string, input: { name?: string; basePriceCents?: number }) => {
      await updateProduct(db, id, input);
      await refresh();
    },
    [db, refresh]
  );

  const removeProduct = useCallback(
    async (id: string) => {
      await deleteProduct(db, id);
      await refresh();
    },
    [db, refresh]
  );

  return {
    categories,
    products,
    loading,
    refresh,
    addCategory,
    renameCategoryById,
    removeCategory,
    addProduct,
    editProduct,
    removeProduct,
  };
}
