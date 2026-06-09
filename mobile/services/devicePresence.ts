import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './sync';

export interface DevicePresenceState {
  device_id: string;
  business_id: string;
  employee_id: string | null;
  employee_name: string;
  role: string;
  device_model: string;
  platform: 'mobile' | 'web';
  battery_level: number | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  push_token: string | null;
  online_at: string;
}

export interface ActiveDeviceView {
  id: string;
  business_id: string;
  employee_id: string | null;
  employee_name: string;
  role: string;
  device_id: string;
  device_model: string;
  battery_level: number | null;
  is_online: boolean;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  push_token: string | null;
  last_active_at: string;
  platform: 'mobile' | 'web';
}

export interface OfflineDeviceSnapshot extends DevicePresenceState {
  record_id: string;
}

const SESSION_REVOKE_EVENT = 'session_revoke';

let channel: RealtimeChannel | null = null;
let currentBusinessId: string | null = null;
let currentDeviceId: string | null = null;
let isTracking = false;
let lastTrackedState: DevicePresenceState | null = null;
let subscribePromise: Promise<void> | null = null;
const presenceListeners = new Set<() => void>();
const revokeListeners = new Set<(targetDeviceId: string) => void>();

const SUBSCRIBE_TIMEOUT_MS = 20000;

function resetSubscribePromise(): void {
  subscribePromise = null;
}

function isChannelJoined(activeChannel: RealtimeChannel): boolean {
  return activeChannel.state === 'joined';
}

async function ensureChannelSubscribed(activeChannel: RealtimeChannel): Promise<void> {
  if (isChannelJoined(activeChannel)) return;

  if (subscribePromise) {
    await subscribePromise;
    if (isChannelJoined(activeChannel)) return;
  }

  subscribePromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resetSubscribePromise();
      reject(new Error('Presence subscribe timeout'));
    }, SUBSCRIBE_TIMEOUT_MS);

    activeChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resetSubscribePromise();
        resolve();
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeout);
        resetSubscribePromise();
        reject(new Error(`Presence channel ${status}`));
      }
    });
  });

  await subscribePromise;
}

export function getDevicesChannelName(businessId: string): string {
  return `devices:${businessId}`;
}

export function buildRecordId(
  businessId: string,
  employeeId: string | null,
  deviceId: string
): string {
  return `${businessId}_${employeeId || 'admin'}_${deviceId}`;
}

export function parsePresenceState(
  raw: Record<string, Record<string, unknown>[]>
): ActiveDeviceView[] {
  const byDeviceId = new Map<string, ActiveDeviceView>();

  for (const [presenceKey, presences] of Object.entries(raw)) {
    for (const entry of presences) {
      const state = entry as unknown as DevicePresenceState;
      if (!state.device_id || !state.business_id) continue;

      const deviceId = state.device_id || presenceKey;
      const lastActiveAt = state.online_at || new Date().toISOString();
      const view: ActiveDeviceView = {
        id: buildRecordId(state.business_id, state.employee_id, deviceId),
        business_id: state.business_id,
        employee_id: state.employee_id ?? null,
        employee_name: state.employee_name || 'Unknown',
        role: state.role || 'cashier',
        device_id: deviceId,
        device_model: state.device_model || 'Unknown Device',
        battery_level: state.battery_level ?? null,
        is_online: true,
        latitude: state.latitude ?? null,
        longitude: state.longitude ?? null,
        location_name: state.location_name ?? null,
        push_token: state.push_token ?? null,
        last_active_at: lastActiveAt,
        platform: state.platform === 'web' ? 'web' : 'mobile',
      };

      const existing = byDeviceId.get(deviceId);
      if (
        !existing ||
        new Date(lastActiveAt).getTime() > new Date(existing.last_active_at).getTime()
      ) {
        byDeviceId.set(deviceId, view);
      }
    }
  }

  return Array.from(byDeviceId.values()).sort(
    (a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
  );
}

export function getPresenceDevices(): ActiveDeviceView[] {
  if (!channel) return [];
  return parsePresenceState(channel.presenceState());
}

function notifyPresenceListeners(): void {
  presenceListeners.forEach((listener) => listener());
}

function ensureChannel(businessId: string, deviceId: string): RealtimeChannel {
  const isChannelValid =
    channel &&
    currentBusinessId === businessId &&
    currentDeviceId === deviceId &&
    (!(channel as any).joinedOnce || channel.state === 'joined' || channel.state === 'joining');

  if (isChannelValid) {
    return channel!;
  }

  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
    isTracking = false;
    resetSubscribePromise();
  }

  currentBusinessId = businessId;
  currentDeviceId = deviceId;

  channel = supabase.channel(getDevicesChannelName(businessId), {
    config: {
      presence: { key: deviceId, enabled: true },
    },
  });

  attachPresenceListeners(channel);
  channel.on('broadcast', { event: SESSION_REVOKE_EVENT }, ({ payload }) => {
    const data = payload as { targetDeviceId?: string } | null;
    if (data?.targetDeviceId) {
      revokeListeners.forEach((listener) => listener(data.targetDeviceId!));
    }
  });

  return channel;
}

export async function checkDeviceRevoked(businessId: string, deviceId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('device_session_revocations')
    .select('device_id')
    .eq('business_id', businessId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to check device revocation:', error);
    return false;
  }

  return !!data;
}

export async function writeOfflineSnapshot(snapshot: OfflineDeviceSnapshot): Promise<void> {
  const payload = {
    id: snapshot.record_id,
    business_id: snapshot.business_id,
    employee_id: snapshot.employee_id,
    employee_name: snapshot.employee_name,
    role: snapshot.role,
    device_id: snapshot.device_id,
    device_model: snapshot.device_model,
    battery_level: snapshot.battery_level,
    is_online: false,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    location_name: snapshot.location_name,
    push_token: snapshot.push_token,
    last_active_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('active_devices').upsert(payload);
  if (error) {
    console.warn('Failed to write offline device snapshot:', error);
  }
}

export async function deleteOfflineSnapshot(businessId: string, deviceId: string): Promise<void> {
  const { error } = await supabase
    .from('active_devices')
    .delete()
    .eq('business_id', businessId)
    .eq('device_id', deviceId);

  if (error) {
    console.warn('Failed to delete offline device snapshot:', error);
  }
}

export async function revokeDeviceSession(params: {
  businessId: string;
  targetDeviceId: string;
  revokedByDeviceId: string;
}): Promise<{ error: string | null }> {
  const { businessId, targetDeviceId, revokedByDeviceId } = params;

  if (channel && currentBusinessId === businessId) {
    await channel.send({
      type: 'broadcast',
      event: SESSION_REVOKE_EVENT,
      payload: { targetDeviceId, businessId },
    });
  } else {
    const tempChannel = supabase.channel(getDevicesChannelName(businessId));
    await new Promise<void>((resolve) => {
      tempChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await tempChannel.send({
            type: 'broadcast',
            event: SESSION_REVOKE_EVENT,
            payload: { targetDeviceId, businessId },
          });
          await supabase.removeChannel(tempChannel);
          resolve();
        }
      });
    });
  }

  const { error: revokeError } = await supabase.from('device_session_revocations').upsert({
    business_id: businessId,
    device_id: targetDeviceId,
    revoked_at: new Date().toISOString(),
    revoked_by_device_id: revokedByDeviceId,
  });

  if (revokeError) {
    return { error: revokeError.message };
  }

  await deleteOfflineSnapshot(businessId, targetDeviceId);
  return { error: null };
}

function attachPresenceListeners(target: RealtimeChannel): void {
  target
    .on('presence', { event: 'sync' }, () => notifyPresenceListeners())
    .on('presence', { event: 'join' }, () => notifyPresenceListeners())
    .on('presence', { event: 'leave' }, () => notifyPresenceListeners());
}

/**
 * Read-only subscription for admin dashboards. Reuses the tracker channel when present.
 */
export function subscribePresenceObserver(options: {
  businessId: string;
  onPresenceChange?: () => void;
}): () => void {
  const { businessId, onPresenceChange } = options;

  if (!channel || currentBusinessId !== businessId) {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
      isTracking = false;
      currentDeviceId = null;
      resetSubscribePromise();
    }

    currentBusinessId = businessId;
    channel = supabase.channel(getDevicesChannelName(businessId), {
      config: {
        presence: { enabled: true },
      },
    });
    attachPresenceListeners(channel);
    void ensureChannelSubscribed(channel).catch((err) => {
      console.warn('Presence observer subscribe failed:', err);
    });
  }

  if (onPresenceChange) {
    presenceListeners.add(onPresenceChange);
    onPresenceChange();
  }

  return () => {
    if (onPresenceChange) presenceListeners.delete(onPresenceChange);
  };
}

export function subscribeDevicePresence(options: {
  businessId: string;
  deviceId: string;
  onPresenceChange?: () => void;
  onSessionRevoke?: (targetDeviceId: string) => void;
}): () => void {
  const { businessId, deviceId, onPresenceChange, onSessionRevoke } = options;
  const activeChannel = ensureChannel(businessId, deviceId);

  if (onPresenceChange) {
    presenceListeners.add(onPresenceChange);
  }
  if (onSessionRevoke) {
    revokeListeners.add(onSessionRevoke);
  }

  void ensureChannelSubscribed(activeChannel).catch((err) => {
    console.warn('Presence subscribe failed:', err);
  });

  return () => {
    if (onPresenceChange) presenceListeners.delete(onPresenceChange);
    if (onSessionRevoke) revokeListeners.delete(onSessionRevoke);
  };
}

export async function startDevicePresenceTracking(
  businessId: string,
  deviceId: string,
  state: DevicePresenceState,
  onSessionRevoke?: (targetDeviceId: string) => void
): Promise<void> {
  const activeChannel = ensureChannel(businessId, deviceId);

  if (onSessionRevoke) {
    revokeListeners.add(onSessionRevoke);
  }

  const revoked = await checkDeviceRevoked(businessId, deviceId);
  if (revoked) {
    throw new Error('DEVICE_REVOKED');
  }

  await ensureChannelSubscribed(activeChannel);
  await trackPresenceState(state);
}

export async function trackPresenceState(state: DevicePresenceState): Promise<void> {
  if (!channel) return;

  lastTrackedState = {
    ...state,
    online_at: new Date().toISOString(),
  };

  const status = await channel.track(lastTrackedState);
  if (status !== 'ok') {
    console.warn('Failed to track device presence:', status);
  } else {
    isTracking = true;
  }
}

export async function untrackDevicePresence(): Promise<void> {
  if (!channel || !isTracking) return;

  try {
    await channel.untrack();
  } catch (err) {
    console.warn('Failed to untrack device presence:', err);
  } finally {
    isTracking = false;
  }
}

export async function teardownDevicePresence(options?: { writeSnapshot?: boolean }): Promise<void> {
  const shouldWriteSnapshot = options?.writeSnapshot ?? false;

  if (shouldWriteSnapshot && lastTrackedState && currentBusinessId && currentDeviceId) {
    await writeOfflineSnapshot({
      ...lastTrackedState,
      record_id: buildRecordId(
        lastTrackedState.business_id,
        lastTrackedState.employee_id,
        lastTrackedState.device_id
      ),
    });
  }

  await untrackDevicePresence();

  if (channel) {
    await supabase.removeChannel(channel);
    channel = null;
    resetSubscribePromise();
  }

  currentBusinessId = null;
  currentDeviceId = null;
  lastTrackedState = null;
  presenceListeners.clear();
  revokeListeners.clear();
}

export async function fetchRecentlyOfflineDevices(
  businessId: string,
  hours = 24
): Promise<ActiveDeviceView[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('active_devices')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_online', false)
    .gte('last_active_at', since)
    .order('last_active_at', { ascending: false });

  if (error) {
    console.warn('Failed to fetch recently offline devices:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    business_id: row.business_id,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    role: row.role,
    device_id: row.device_id,
    device_model: row.device_model,
    battery_level: row.battery_level,
    is_online: false,
    latitude: row.latitude,
    longitude: row.longitude,
    location_name: row.location_name,
    push_token: row.push_token,
    last_active_at: row.last_active_at,
    platform: row.device_model?.toLowerCase().includes('web') ? 'web' : 'mobile',
  }));
}
