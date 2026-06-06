import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '../../../constants/tokens';
import { useAuthStore } from '../../../stores/useAuthStore';
import { getTopSafeInset } from '../../../utils/safeArea';
import { DEVICE_ID_KEY } from '../../../hooks/useActiveDeviceTracker';
import {
  fetchRecentlyOfflineDevices,
  getPresenceDevices,
  revokeDeviceSession,
  subscribePresenceObserver,
  type ActiveDeviceView,
} from '../../../services/devicePresence';

export default function ActiveDevicesRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeBusinessId = useAuthStore((state) => state.activeBusinessId);

  const [onlineDevices, setOnlineDevices] = useState<ActiveDeviceView[]>([]);
  const [offlineDevices, setOfflineDevices] = useState<ActiveDeviceView[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const refreshOnlineDevices = useCallback(() => {
    setOnlineDevices(getPresenceDevices());
    setLoading(false);
  }, []);

  const loadOfflineDevices = useCallback(async () => {
    if (!activeBusinessId) return;
    const offline = await fetchRecentlyOfflineDevices(activeBusinessId);
    const onlineIds = new Set(getPresenceDevices().map((d) => d.device_id));
    setOfflineDevices(offline.filter((d) => !onlineIds.has(d.device_id)));
  }, [activeBusinessId]);

  useEffect(() => {
    if (!activeBusinessId) return;

    AsyncStorage.getItem(DEVICE_ID_KEY).then((id) => {
      setCurrentDeviceId(id);
    });

    setLoading(true);
    refreshOnlineDevices();
    void loadOfflineDevices();

    const unsubscribe = subscribePresenceObserver({
      businessId: activeBusinessId,
      onPresenceChange: () => {
        refreshOnlineDevices();
        void loadOfflineDevices();
      },
    });

    return unsubscribe;
  }, [activeBusinessId, refreshOnlineDevices, loadOfflineDevices]);

  const handleTerminateSession = (targetDeviceId: string, name: string) => {
    Alert.alert(
      'Terminate Session',
      `Are you sure you want to remotely sign out "${name}" from this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out Device',
          style: 'destructive',
          onPress: async () => {
            try {
              const revokedBy = currentDeviceId || 'admin';
              const { error } = await revokeDeviceSession({
                businessId: activeBusinessId!,
                targetDeviceId,
                revokedByDeviceId: revokedBy,
              });

              if (error) {
                triggerToast('Failed to terminate session.');
              } else {
                triggerToast('Session terminated successfully! 🗑️');
                refreshOnlineDevices();
                void loadOfflineDevices();
              }
            } catch (err) {
              console.error(err);
              triggerToast('An error occurred.');
            }
          },
        },
      ]
    );
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return { backgroundColor: '#E6F4EA', color: '#137333' };
      case 'manager':
        return { backgroundColor: '#E8F0FE', color: TOKENS.primary };
      default:
        return { backgroundColor: '#F3F4F6', color: TOKENS.dark };
    }
  };

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const renderDeviceCard = (device: ActiveDeviceView, isOnline: boolean) => {
    const isCurrent = device.device_id === currentDeviceId;
    const badge = getRoleBadgeStyle(device.role);

    return (
      <View key={device.id} style={[styles.deviceCard, isCurrent && styles.deviceCardCurrent]}>
        <View style={styles.deviceCardLeft}>
          <View
            style={[
              styles.deviceIconBox,
              isCurrent ? { backgroundColor: TOKENS.lightBlue } : { backgroundColor: '#F3F4F6' },
            ]}
          >
            <Feather
              name={
                device.device_model.toLowerCase().includes('mac') ||
                device.device_model.toLowerCase().includes('pc') ||
                device.device_model.toLowerCase().includes('web')
                  ? 'monitor'
                  : 'smartphone'
              }
              size={22}
              color={isCurrent ? TOKENS.primary : TOKENS.dark}
            />
          </View>
          <View style={styles.deviceDetails}>
            <View style={styles.deviceHeaderRow}>
              <Text style={styles.employeeName}>{device.employee_name}</Text>
              <View style={[styles.roleBadge, { backgroundColor: badge.backgroundColor }]}>
                <Text style={[styles.roleBadgeText, { color: badge.color }]}>
                  {device.role.toUpperCase()}
                </Text>
              </View>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>This Device</Text>
                </View>
              )}
            </View>

            <Text style={styles.deviceModel}>{device.device_model}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isOnline ? TOKENS.success : TOKENS.muted },
                  ]}
                />
                <Text style={styles.statText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>

              {isOnline && device.battery_level !== null && device.battery_level >= 0 && (
                <View style={styles.statItem}>
                  <Feather name="battery" size={12} color={TOKENS.muted} />
                  <Text style={styles.statText}>{device.battery_level}%</Text>
                </View>
              )}

              <View style={styles.statItem}>
                <Feather name="clock" size={12} color={TOKENS.muted} />
                <Text style={styles.statText}>{formatLastActive(device.last_active_at)}</Text>
              </View>
            </View>

            {device.location_name && (
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={TOKENS.muted} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {device.location_name}
                </Text>
              </View>
            )}

            {device.push_token ? (
              <View style={styles.tokenRow}>
                <Feather name="bell" size={12} color={TOKENS.primary} />
                <Text style={styles.tokenText} numberOfLines={1} ellipsizeMode="middle">
                  {device.push_token}
                </Text>
                <TouchableOpacity
                  style={styles.copyTokenBtn}
                  activeOpacity={0.7}
                  onPress={async () => {
                    await Clipboard.setStringAsync(device.push_token || '');
                    triggerToast('Push token copied! 📋');
                  }}
                >
                  <Feather name="copy" size={11} color={TOKENS.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.tokenRow}>
                <Feather name="bell-off" size={12} color={TOKENS.muted} />
                <Text style={[styles.tokenText, { color: TOKENS.muted }]} numberOfLines={1}>
                  No push token registered
                </Text>
              </View>
            )}
          </View>
        </View>

        {!isCurrent && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.terminateButton}
            onPress={() => handleTerminateSession(device.device_id, device.employee_name)}
          >
            <Feather name="log-out" size={15} color={TOKENS.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const hasDevices = onlineDevices.length > 0 || offlineDevices.length > 0;

  return (
    <View style={[styles.container, { paddingTop: getTopSafeInset(insets) }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push('/profile')}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Active Devices</Text>

        <TouchableOpacity
          style={styles.refreshButton}
          activeOpacity={0.8}
          onPress={() => {
            setLoading(true);
            refreshOnlineDevices();
            void loadOfflineDevices();
          }}
        >
          <Feather name="refresh-cw" size={18} color={TOKENS.primary} />
        </TouchableOpacity>
      </View>

      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={15} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={TOKENS.primary} />
          <Text style={styles.loaderText}>Loading login sessions...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollWrapper}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.groupLabel}>Online Now</Text>
          {onlineDevices.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineText}>No devices online right now</Text>
            </View>
          ) : (
            onlineDevices.map((device) => renderDeviceCard(device, true))
          )}

          {offlineDevices.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { marginTop: 16 }]}>Recently Offline (24h)</Text>
              {offlineDevices.map((device) => renderDeviceCard(device, false))}
            </>
          )}

          {!hasDevices && (
            <View style={styles.emptyContainer}>
              <Feather name="smartphone" size={48} color={TOKENS.muted} />
              <Text style={styles.emptyTitle}>No active sessions</Text>
              <Text style={styles.emptySubtitle}>
                No device logs are currently active for this business.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: TOKENS.dark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 12,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: TOKENS.muted,
    fontWeight: '600',
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyInline: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    alignItems: 'center',
  },
  emptyInlineText: {
    fontSize: 12,
    color: TOKENS.muted,
    fontWeight: '500',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
  },
  deviceCardCurrent: {
    borderColor: TOKENS.primary,
    borderWidth: 1.5,
    backgroundColor: '#F9FBFD',
  },
  deviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  deviceIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  deviceDetails: {
    flex: 1,
    gap: 4,
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  roleBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  currentBadge: {
    backgroundColor: TOKENS.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: TOKENS.card,
  },
  deviceModel: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.dark,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingRight: 16,
  },
  locationText: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: '500',
    flex: 1,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingRight: 24,
  },
  tokenText: {
    fontSize: 10,
    color: TOKENS.primary,
    fontWeight: '500',
    maxWidth: '80%',
  },
  copyTokenBtn: {
    padding: 4,
  },
  terminateButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FCE8E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 32,
    gap: 10,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  emptySubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: 'center',
  },
});
