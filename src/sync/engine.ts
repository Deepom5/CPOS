import NetInfo, { type NetInfoSubscription } from '@react-native-community/netinfo';
import type { SQLiteDatabase } from 'expo-sqlite';

import { countPending, listReadyBatches, markBatchFailed, markBatchSynced } from '@/data/repos/outbox';
import { useSyncStore } from '@/state/sync-store';

const DRAIN_INTERVAL_MS = 5_000;
const BACKOFF_BASE_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let netSub: NetInfoSubscription | null = null;
let draining = false;

/**
 * Mock network call to "the server". Until the backend exists this just resolves
 * after a short delay so the outbox can drain in development. Replace with a real
 * client when the API ships.
 */
async function postBatchToServer(batchId: string, ops: unknown[]): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  // eslint-disable-next-line no-console
  console.log(`[sync] mock-pushed batch ${batchId} (${ops.length} ops)`);
}

async function refreshCounts(db: SQLiteDatabase) {
  const pending = await countPending(db);
  useSyncStore.getState().setPending(pending);
}

async function drainOnce(db: SQLiteDatabase) {
  if (draining) return;
  if (useSyncStore.getState().connection !== 'online') return;
  draining = true;
  useSyncStore.getState().setSyncing(true);
  try {
    const batches = await listReadyBatches(db, Date.now(), 3);
    if (batches.size === 0) {
      await refreshCounts(db);
      return;
    }
    for (const [batchId, ops] of batches) {
      try {
        await postBatchToServer(batchId, ops);
        await markBatchSynced(db, batchId);
        useSyncStore.getState().markSynced();
      } catch (err) {
        const attempts = ops[0]?.attempts ?? 0;
        const delay = Math.min(BACKOFF_BASE_MS * 2 ** attempts, MAX_BACKOFF_MS);
        const message = err instanceof Error ? err.message : String(err);
        await markBatchFailed(db, batchId, message, delay);
        useSyncStore.getState().setLastError(message);
      }
    }
    await refreshCounts(db);
  } finally {
    draining = false;
    useSyncStore.getState().setSyncing(false);
  }
}

export function startSyncEngine(db: SQLiteDatabase): () => void {
  // Initial counts on boot.
  void refreshCounts(db);

  netSub = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    useSyncStore.getState().setConnection(online ? 'online' : 'offline');
    if (online) void drainOnce(db);
  });

  timer = setInterval(() => {
    void drainOnce(db);
  }, DRAIN_INTERVAL_MS);

  return () => {
    if (timer) clearInterval(timer);
    if (netSub) netSub();
    timer = null;
    netSub = null;
  };
}

export function requestImmediateDrain(db: SQLiteDatabase) {
  void drainOnce(db);
}
