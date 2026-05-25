import { synchronize } from '@nozbe/watermelondb/sync'
import { createClient } from '@supabase/supabase-js'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import database from '@/components/data/db'
import { schema } from '@/components/data/db/schema'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase env missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env'
  )
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder-key'
)

const PUSH_TABLE_ORDER = [
  'businesses',
  'employees',
  'products',
  'orders',
  'order_items',
  'inventory_logs',
] as const

type SyncTableName = (typeof PUSH_TABLE_ORDER)[number]
type TableChanges = {
  created?: unknown[]
  updated?: unknown[]
  deleted?: unknown[]
}
type SyncChanges = Partial<Record<SyncTableName, TableChanges>>

function tableHasChanges(slice: TableChanges | undefined): boolean {
  if (!slice) return false
  return (
    (slice.created?.length ?? 0) > 0 ||
    (slice.updated?.length ?? 0) > 0 ||
    (slice.deleted?.length ?? 0) > 0
  )
}

async function pushChangesInOrder(changes: SyncChanges): Promise<void> {
  for (const table of PUSH_TABLE_ORDER) {
    const slice = changes[table]
    if (!tableHasChanges(slice)) continue

    const { error } = await supabase.rpc('push_watermelondb_changes', {
      changes: { [table]: slice },
    })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

/** Restore an existing Supabase session if present. Sync works without login via anon RPC. */
async function prepareSupabaseForSync(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  useAuthStore.getState().setSession(session)
  if (session.user) useAuthStore.getState().setUser(session.user)
}

export async function syncDatabase(): Promise<boolean> {
  const isBackupEnabled = useSettingsStore.getState().isBackupEnabled
  if (!isBackupEnabled) {
    return false
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('Sync skipped: Supabase environment variables are not configured.')
    return false
  }

  await prepareSupabaseForSync()

  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }) => {
        const { data, error } = await supabase.rpc('pull_watermelondb_changes', {
          last_pulled_at: lastPulledAt ?? 0,
        })
        if (error) throw new Error(error.message)
        return { changes: data.changes, timestamp: data.timestamp }
      },
      pushChanges: async ({ changes }) => {
        await pushChangesInOrder(changes as SyncChanges)
      },
      migrationsEnabledAtVersion: schema.version,
    })
    console.log('Database synced successfully')
    return true
  } catch (error) {
    console.error('Failed to sync database:', error)
    return false
  }
}
