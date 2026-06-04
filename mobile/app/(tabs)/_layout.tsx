import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { BottomTabBar } from '../../components/common/BottomTabBar';
import { useTabBarVisible } from '../../hooks/useTabBarVisible';
import { useActiveDeviceTracker } from '../../hooks/useActiveDeviceTracker';
import { useWatermelonSync } from '../../hooks/useWatermelonSync';
import { useAuthStore } from '../../stores/useAuthStore';
import { syncDatabase, supabase, getClientId } from '../../services/sync';

export default function TabLayout() {
  useActiveDeviceTracker();
  useWatermelonSync(); // Enable periodic background database sync

  const { tabBarVisible } = useTabBarVisible();
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);

  // Subscribe to real-time sync trigger broadcasts for active business
  useEffect(() => {
    if (!activeBusinessId) return;

    const clientId = getClientId();
    const channel = supabase
      .channel(`sync:${activeBusinessId}`)
      .on('broadcast', { event: 'sync_trigger' }, (payload) => {
        const data = payload.payload;
        if (data && data.senderId !== clientId && data.businessId === activeBusinessId) {
          console.log(
            `[Sync Broadcast] Received sync trigger from device: ${data.senderId}. Syncing...`
          );
          syncDatabase().catch((err) => console.error('Realtime sync failed:', err));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(
            `[Sync Broadcast] Subscribed to realtime sync channel: sync:${activeBusinessId}`
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBusinessId]);

  useEffect(() => {
    Animated.spring(translateYAnim, {
      toValue: tabBarVisible ? 0 : 130, // Animates completely off-screen (accounting for safe area padding)
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [tabBarVisible]);

  const mapRouteToTab = (routeName: string): any => {
    if (routeName === 'index') return 'home';
    return routeName;
  };

  return (
    <Tabs
      tabBar={(props) => {
        const routeName = props.state.routeNames[props.state.index];
        const activeTab = mapRouteToTab(routeName);
        return (
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transform: [{ translateY: translateYAnim }],
              zIndex: 100,
            }}
          >
            <BottomTabBar
              activeTab={activeTab}
              onTabPress={(tabId) => {
                const routeName =
                  tabId === 'home' ? 'index' : tabId === 'orders' ? 'insights' : tabId;
                props.navigation.navigate(routeName);
              }}
            />
          </Animated.View>
        );
      }}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: 'POS',
        }}
      />
      <Tabs.Screen
        name="stocks"
        options={{
          title: 'Stocks',
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}
