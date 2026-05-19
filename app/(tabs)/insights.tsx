import React from "react";
import { Stack } from "expo-router";
import { InsightsScreen } from "@/components/screens/InsightsScreen";

export default function InsightsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <InsightsScreen />
    </>
  );
}
