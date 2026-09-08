import { synchronize } from '@nozbe/watermelondb/sync';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useAuthStore } from '../stores/useAuthStore';
import database from '@/components/data/db';
import { schema } from '@/components/data/db/schema';

import { supabase, supabaseKey, supabaseUrl } from './supabaseClient';

export { supabase };

let memoizedClientId = '';
export function getClientId(): string {
  if (!memoizedClientId) {
    memoizedClientId =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  return memoizedClientId;
}

const PUSH_TABLE_ORDER = [
  'businesses',
  'employees',
  'products',
  'orders',
  'order_items',
  'inventory_logs',
] as const;

type SyncTableName = (typeof PUSH_TABLE_ORDER)[number];
type TableChanges = {
  created?: unknown[];
  updated?: unknown[];
  deleted?: unknown[];
};
type SyncChanges = Partial<Record<SyncTableName, TableChanges>>;

function tableHasChanges(slice: TableChanges | undefined): boolean {
  if (!slice) return false;
  return (
    (slice.created?.length ?? 0) > 0 ||
    (slice.updated?.length ?? 0) > 0 ||
    (slice.deleted?.length ?? 0) > 0
  );
}

type PullRecord = { id: string; created_at?: number; updated_at?: number };

/**
 * With sendCreatedAsUpdated, Watermelon expects every non-deleted remote row in
 * `updated`. Merge both buckets so creates/updates apply without diagnostic errors
 * when another device pushed the row or a deferred sync replays the same pull.
 */
function normalizePulledChanges(changes: SyncChanges): SyncChanges {
  const normalized: SyncChanges = { ...changes };

  for (const table of PUSH_TABLE_ORDER) {
    const slice = normalized[table];
    if (!slice) continue;

    const merged = new Map<string, PullRecord>();
    for (const raw of [...(slice.created ?? []), ...(slice.updated ?? [])] as PullRecord[]) {
      merged.set(raw.id, raw);
    }

    if (merged.size === 0 && !slice.deleted?.length) continue;

    normalized[table] = {
      ...slice,
      created: [],
      updated: Array.from(merged.values()),
    };
  }

  return normalized;
}

async function pushChangesInOrder(changes: SyncChanges, clientBusinessId: string): Promise<void> {
  for (const table of PUSH_TABLE_ORDER) {
    const slice = changes[table];
    if (!tableHasChanges(slice)) continue;

    const { error } = await supabase.rpc('push_watermelondb_changes', {
      changes: { [table]: slice },
      client_business_id: clientBusinessId,
    });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/** Restore an existing Supabase session if present. Sync works without login via anon RPC. */
async function prepareSupabaseForSync(): Promise<void> {
  // Client runs anonymously with anon key. Authentication is enforced at the RPC layer by passing client_business_id.
}

let isSyncInProgress = false;
let hasPendingSyncRequest = false;
let forceFullPullBusinessId: string | null = null;
let onSyncSuccess: (() => void) | null = null;

/** Register a callback to refresh React Query caches after a successful pull/push sync. */
export function setOnSyncSuccess(fn: () => void) {
  onSyncSuccess = fn;
}

/** Request a full pull for a business (e.g. after switching branches). */
export function requestFullPullForBusiness(businessId: string) {
  forceFullPullBusinessId = businessId;
}

export async function syncDatabase(): Promise<boolean> {
  const isBackupEnabled = useSettingsStore.getState().isBackupEnabled;
  if (!isBackupEnabled) {
    return false;
  }

  if (isSyncInProgress) {
    hasPendingSyncRequest = true;
    console.log('[Sync] Synchronization already in progress. Request deferred.');
    return false;
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('Sync skipped: Supabase environment variables are not configured.');
    return false;
  }

  isSyncInProgress = true;
  hasPendingSyncRequest = false;

  const runSync = async (): Promise<boolean> => {
    await prepareSupabaseForSync();

    const activeBusinessId = useAuthStore.getState().activeBusinessId;
    if (!activeBusinessId) {
      console.warn('Sync skipped: No active business ID selected.');
      return false;
    }

    await synchronize({
      database,
      sendCreatedAsUpdated: true,
      pullChanges: async ({ lastPulledAt }) => {
        let effectiveLastPulledAt = lastPulledAt ?? 0;
        if (forceFullPullBusinessId === activeBusinessId) {
          effectiveLastPulledAt = 0;
          forceFullPullBusinessId = null;
        }

        const { data, error } = await supabase.rpc('pull_watermelondb_changes', {
          last_pulled_at: effectiveLastPulledAt,
          client_business_id: activeBusinessId,
        });
        if (error) throw new Error(error.message);
        return {
          changes: normalizePulledChanges(data.changes as SyncChanges),
          timestamp: data.timestamp,
        };
      },
      pushChanges: async ({ changes }) => {
        await pushChangesInOrder(changes as SyncChanges, activeBusinessId);

        // Broadcast sync trigger to other active terminals
        const hasChanges = Object.values(changes).some((slice) =>
          tableHasChanges(slice as TableChanges | undefined)
        );
        if (hasChanges) {
          console.log('[Sync] Local changes pushed. Broadcasting sync trigger...');
          supabase
            .channel(`sync:${activeBusinessId}`, { config: { private: true } })
            .send({
              type: 'broadcast',
              event: 'sync_trigger',
              payload: {
                senderId: getClientId(),
                businessId: activeBusinessId,
                timestamp: Date.now(),
              },
            })
            .catch((err) => console.error('[Sync] Broadcast failed:', err));
        }
      },
      migrationsEnabledAtVersion: schema.version,
    });
    console.log('Database synced successfully');
    return true;
  };

  try {
    const success = await runSync();
    isSyncInProgress = false;

    if (success) {
      onSyncSuccess?.();
    }

    if (hasPendingSyncRequest) {
      hasPendingSyncRequest = false;
      console.log('[Sync] Running deferred synchronization request...');
      setTimeout(() => {
        syncDatabase();
      }, 50);
    }

    return success;
  } catch (error) {
    isSyncInProgress = false;
    hasPendingSyncRequest = false;
    console.error('Failed to sync database:', error);
    return false;
  }
}
