import type { SQLiteDatabase } from 'expo-sqlite';

import { DEMO_DEVICE_ID, DEMO_LOCATION_ID, DEMO_TENANT_ID } from '@/lib/constants';
import { toCents } from '@/lib/money';
import { uuidv7 } from '@/lib/uuid';

interface SeedCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  products: { name: string; price: number; description?: string }[];
}

const SEED: SeedCategory[] = [
  {
    id: '01900000-0001-7000-8000-000000000001',
    name: 'Coffee',
    color: '#A0522D',
    icon: 'coffee',
    products: [
      { name: 'Espresso', price: 3.0 },
      { name: 'Americano', price: 3.5 },
      { name: 'Latte', price: 4.5 },
      { name: 'Cappuccino', price: 4.25 },
      { name: 'Mocha', price: 4.75 },
      { name: 'Flat White', price: 4.5 },
      { name: 'Cortado', price: 4.0 },
      { name: 'Macchiato', price: 3.75 },
    ],
  },
  {
    id: '01900000-0001-7000-8000-000000000002',
    name: 'Tea',
    color: '#3F8E5B',
    icon: 'leaf',
    products: [
      { name: 'English Breakfast', price: 3.0 },
      { name: 'Earl Grey', price: 3.0 },
      { name: 'Green Tea', price: 3.25 },
      { name: 'Chai Latte', price: 4.25 },
      { name: 'Matcha Latte', price: 4.75 },
    ],
  },
  {
    id: '01900000-0001-7000-8000-000000000003',
    name: 'Cold',
    color: '#3478F6',
    icon: 'snowflake',
    products: [
      { name: 'Iced Latte', price: 4.75 },
      { name: 'Iced Americano', price: 3.75 },
      { name: 'Cold Brew', price: 4.5 },
      { name: 'Iced Matcha', price: 5.0 },
      { name: 'Lemonade', price: 3.5 },
      { name: 'Iced Tea', price: 3.25 },
    ],
  },
  {
    id: '01900000-0001-7000-8000-000000000004',
    name: 'Bakery',
    color: '#E29A3B',
    icon: 'bread',
    products: [
      { name: 'Croissant', price: 3.0 },
      { name: 'Pain au Chocolat', price: 3.5 },
      { name: 'Almond Croissant', price: 3.75 },
      { name: 'Blueberry Muffin', price: 3.25 },
      { name: 'Banana Bread', price: 3.5 },
      { name: 'Bagel', price: 2.75 },
      { name: 'Scone', price: 3.0 },
    ],
  },
  {
    id: '01900000-0001-7000-8000-000000000005',
    name: 'Sweets',
    color: '#D94C7F',
    icon: 'cake',
    products: [
      { name: 'Chocolate Chip Cookie', price: 2.5 },
      { name: 'Brownie', price: 3.25 },
      { name: 'Carrot Cake Slice', price: 4.5 },
      { name: 'Cheesecake Slice', price: 4.75 },
      { name: 'Macaron', price: 2.25 },
    ],
  },
];

export async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM categories');
  if ((row?.c ?? 0) > 0) return;

  const now = Date.now();

  await db.withTransactionAsync(async () => {
    let catSort = 0;
    for (const cat of SEED) {
      await db.runAsync(
        `INSERT INTO categories
          (id, tenant_id, location_id, name, color, icon, sort_order, active,
           version, server_version, sync_status, last_synced_at,
           created_at, updated_at, device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 'synced', ?, ?, ?, ?)`,
        [
          cat.id,
          DEMO_TENANT_ID,
          DEMO_LOCATION_ID,
          cat.name,
          cat.color,
          cat.icon,
          catSort++,
          now,
          now,
          now,
          DEMO_DEVICE_ID,
        ]
      );

      let prodSort = 0;
      for (const p of cat.products) {
        await db.runAsync(
          `INSERT INTO products
            (id, tenant_id, location_id, category_id, name, description,
             base_price_cents, image_url, sku, available, sort_order,
             version, server_version, sync_status, last_synced_at,
             created_at, updated_at, device_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1, ?, 1, 1, 'synced', ?, ?, ?, ?)`,
          [
            uuidv7(),
            DEMO_TENANT_ID,
            DEMO_LOCATION_ID,
            cat.id,
            p.name,
            p.description ?? null,
            toCents(p.price),
            prodSort++,
            now,
            now,
            now,
            DEMO_DEVICE_ID,
          ]
        );
      }
    }
  });
}
