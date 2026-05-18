import React from "react";
import { Stack } from "expo-router";
import { PosScreen } from "../components/screens/PosScreen";

export default function PosRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PosScreen />
    </>
  );
}
