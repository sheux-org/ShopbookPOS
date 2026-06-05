import { synchronize } from '@nozbe/watermelondb/sync';
import { createClient } from '@supabase/supabase-js';
import database from '../db/database';
import { schema } from '../db/schema';
import { useAuthStore } from '../stores/authStore';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

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
  created?: any[];
  updated?: any[];
  deleted?: any[];
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

async function pushChangesInOrder(changes: SyncChanges, clientBusinessId: string): Promise<void> {
  for (const table of PUSH_TABLE_ORDER) {
    const slice = changes[table];
    if (!tableHasChanges(slice)) continue;

    try {
      const { error } = await supabase.rpc('push_watermelondb_changes', {
        changes: { [table]: slice },
        client_business_id: clientBusinessId,
      });
      if (error) throw new Error(`${table}: ${error.message}`);
    } catch (err: any) {
      const isNetworkError =
        err?.message?.includes('fetch') ||
        err?.message?.includes('Network') ||
        err?.name === 'TypeError' ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetworkError) {
        const netErr = new Error('Sync aborted: Network unreachable');
        (netErr as any).isNetworkError = true;
        throw netErr;
      }
      throw err;
    }
  }
}

async function prepareSupabaseForSync(): Promise<void> {
  // Client runs anonymously with anon key. Authentication is enforced at the RPC layer by passing client_business_id.
}

let isSyncInProgress = false;
let hasPendingSyncRequest = false;
let forceFullPullBusinessId: string | null = null;

/** Request a full pull for a business (e.g. after switching branches). */
export function requestFullPullForBusiness(businessId: string) {
  forceFullPullBusinessId = businessId;
}

export async function syncDatabase(force: boolean = true): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (isSyncInProgress) {
    hasPendingSyncRequest = true;
    console.warn('Sync deferred: Another synchronization is already in progress.');
    return false;
  }

  isSyncInProgress = true;
  hasPendingSyncRequest = false;

  const runSync = async (): Promise<boolean> => {
    try {
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
          try {
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
            return { changes: data.changes, timestamp: data.timestamp };
          } catch (err: any) {
            const isNetworkError =
              err?.message?.includes('fetch') ||
              err?.message?.includes('Network') ||
              err?.name === 'TypeError' ||
              (typeof navigator !== 'undefined' && !navigator.onLine);

            if (isNetworkError) {
              const netErr = new Error('Sync aborted: Network unreachable');
              (netErr as any).isNetworkError = true;
              throw netErr;
            }
            throw err;
          }
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
              .channel(`sync:${activeBusinessId}`)
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
    } catch (error: any) {
      const isNetworkError =
        error?.isNetworkError ||
        error?.message?.includes('Network unreachable') ||
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('fetch');

      if (isNetworkError) {
        console.warn('Sync failed due to network connectivity issues (offline mode).');
      } else {
        console.error('Failed to sync database:', error);
      }
      return false;
    }
  };

  try {
    const success = await runSync();
    isSyncInProgress = false;

    if (hasPendingSyncRequest) {
      hasPendingSyncRequest = false;
      console.log('Running deferred synchronization request...');
      setTimeout(() => {
        syncDatabase(force);
      }, 50);
    }

    return success;
  } catch (err) {
    isSyncInProgress = false;
    hasPendingSyncRequest = false;
    return false;
  }
}

export async function uploadBusinessLogo(file: File, businessId: string): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${businessId}/logo_${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage.from('business-logos').upload(fileName, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('business-logos').getPublicUrl(fileName);

  return publicUrl;
}
