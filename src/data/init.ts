import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';
import { seedIfEmpty } from './seed';

/**
 * Called by `SQLiteProvider`'s `onInit`. Runs migrations and seeds the demo
 * menu the first time the app launches.
 */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await runMigrations(db);
  await seedIfEmpty(db);
}
