import { Tabs } from "expo-router";
import React from "react";
import { BottomTabBar } from "../../components/common/BottomTabBar";

export default function TabLayout() {
  const mapRouteToTab = (routeName: string): "home" | "pos" | "stocks" | "profile" => {
    if (routeName === "index") return "home";
    return routeName as any;
  };

  return (
    <Tabs
      tabBar={(props) => {
        const routeName = props.state.routeNames[props.state.index];
        const activeTab = mapRouteToTab(routeName);
        return (
          <BottomTabBar
            activeTab={activeTab}
            onTabPress={(tabId) => {
              const routeName = tabId === "home" ? "index" : tabId;
              props.navigation.navigate(routeName);
            }}
          />
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
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
