import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BottomTabBar } from '../../components/common/BottomTabBar';
import { useTabBarVisible } from '../../hooks/useTabBarVisible';
import { useActiveDeviceTracker } from '../../hooks/useActiveDeviceTracker';
import { useBusinessSwitchSync } from '../../hooks/useBusinessSwitchSync';
import { useWatermelonSync } from '../../hooks/useWatermelonSync';
import { useAuthStore } from '../../stores/useAuthStore';
import { syncDatabase, supabase, getClientId } from '../../services/sync';

export default function TabLayout() {
  useActiveDeviceTracker();
  useBusinessSwitchSync();
  useWatermelonSync(); // Enable periodic background database sync

  const { tabBarVisible } = useTabBarVisible();
  const translateY = useSharedValue(0);
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
    translateY.value = withSpring(tabBarVisible ? 0 : 130);
  }, [tabBarVisible, translateY]);

  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

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
            style={[
              {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 100,
              },
              tabBarAnimatedStyle,
            ]}
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
