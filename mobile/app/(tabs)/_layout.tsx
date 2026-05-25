import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { BottomTabBar } from "../../components/common/BottomTabBar";
import { useTabBarVisible } from "../../hooks/useTabBarVisible";
import { useActiveDeviceTracker } from "../../hooks/useActiveDeviceTracker";

export default function TabLayout() {
  useActiveDeviceTracker();
  const { tabBarVisible } = useTabBarVisible();
  const translateYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateYAnim, {
      toValue: tabBarVisible ? 0 : 130, // Animates completely off-screen (accounting for safe area padding)
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [tabBarVisible]);

  const mapRouteToTab = (routeName: string): any => {
    if (routeName === "index") return "home";
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
              position: "absolute",
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
                const routeName = tabId === "home" ? "index" : (tabId === "orders" ? "insights" : tabId);
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
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: "POS",
        }}
      />
      <Tabs.Screen
        name="stocks"
        options={{
          title: "Stocks",
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}

