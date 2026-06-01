import React from "react";
import { Stack } from "expo-router";
import { OrderHistoryScreen } from "@/components/screens/OrderHistoryScreen";

export default function HistoryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OrderHistoryScreen />
    </>
  );
}
