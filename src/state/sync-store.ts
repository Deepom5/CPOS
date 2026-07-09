import { create } from 'zustand';

export type ConnectionState = 'online' | 'offline' | 'degraded';

interface SyncState {
  connection: ConnectionState;
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  setConnection: (c: ConnectionState) => void;
  setPending: (n: number) => void;
  setFailed: (n: number) => void;
  setSyncing: (b: boolean) => void;
  markSynced: () => void;
  setLastError: (e: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  connection: 'offline',
  pendingCount: 0,
  failedCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,
  setConnection: (c) => set({ connection: c }),
  setPending: (pendingCount) => set({ pendingCount }),
  setFailed: (failedCount) => set({ failedCount }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  markSynced: () => set({ lastSyncedAt: Date.now(), lastError: null }),
  setLastError: (lastError) => set({ lastError }),
}));
