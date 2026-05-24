import React from "react";
import { Stack } from "expo-router";
import { InsightsScreen } from "@/components/screens/insights/InsightsScreen";
import { OrderHistoryScreen } from "@/components/screens/OrderHistoryScreen";
import { useUserPermissions } from "@/hooks/useUserPermissions";

export default function InsightsRoute() {
  const { role } = useUserPermissions();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {role === "cashier" ? <OrderHistoryScreen isTab={true} /> : <InsightsScreen />}
    </>
  );
}
