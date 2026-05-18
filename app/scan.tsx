import React from "react";
import { Stack } from "expo-router";
import { ScanScreen } from "../components/screens/ScanScreen";

export default function ScanRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScanScreen />
    </>
  );
}
