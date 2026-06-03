import { synchronize } from '@nozbe/watermelondb/sync';
import { createClient } from '@supabase/supabase-js';
import database from '../db/database';
import { schema } from '../db/schema';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

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

async function pushChangesInOrder(changes: SyncChanges): Promise<void> {
  for (const table of PUSH_TABLE_ORDER) {
    const slice = changes[table];
    if (!tableHasChanges(slice)) continue;

    const { error } = await supabase.rpc('push_watermelondb_changes', {
      changes: { [table]: slice },
    });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function prepareSupabaseForSync(): Promise<void> {
  if (typeof window === 'undefined') return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  useAuthStore.getState().setSession(session);
  if (session.user) useAuthStore.getState().setUser(session.user);
}

export async function syncDatabase(force: boolean = true): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const isBackupEnabled = useSettingsStore.getState().isBackupEnabled;
  if (!isBackupEnabled && !force) {
    return false;
  }

  await prepareSupabaseForSync();

  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }) => {
        const { data, error } = await supabase.rpc('pull_watermelondb_changes', {
          last_pulled_at: lastPulledAt ?? 0,
        });
        if (error) throw new Error(error.message);
        return { changes: data.changes, timestamp: data.timestamp };
      },
      pushChanges: async ({ changes }) => {
        await pushChangesInOrder(changes as SyncChanges);
      },
      migrationsEnabledAtVersion: schema.version,
    });
    console.log('Database synced successfully');
    return true;
  } catch (error) {
    console.error('Failed to sync database:', error);
    return false;
  }
}

export async function uploadBusinessLogo(file: File, businessId: string): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${businessId}/logo_${Date.now()}.${fileExt}`;
  
  const { error } = await supabase.storage
    .from('business-logos')
    .upload(fileName, file, {
      contentType: file.type,
      upsert: true,
    });
    
  if (error) {
    throw error;
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('business-logos')
    .getPublicUrl(fileName);
    
  return publicUrl;
}
