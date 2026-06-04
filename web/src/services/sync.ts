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

    const { error } = await supabase.rpc('push_watermelondb_changes', {
      changes: { [table]: slice },
      client_business_id: clientBusinessId,
    });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function prepareSupabaseForSync(): Promise<void> {
  // Client runs anonymously with anon key. Authentication is enforced at the RPC layer by passing client_business_id.
}

let isSyncInProgress = false;
let hasPendingSyncRequest = false;

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
        pullChanges: async ({ lastPulledAt }) => {
          const { data, error } = await supabase.rpc('pull_watermelondb_changes', {
            last_pulled_at: lastPulledAt ?? 0,
            client_business_id: activeBusinessId,
          });
          if (error) throw new Error(error.message);
          return { changes: data.changes, timestamp: data.timestamp };
        },
        pushChanges: async ({ changes }) => {
          await pushChangesInOrder(changes as SyncChanges, activeBusinessId);
        },
        migrationsEnabledAtVersion: schema.version,
      });
      console.log('Database synced successfully');
      return true;
    } catch (error) {
      console.error('Failed to sync database:', error);
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
