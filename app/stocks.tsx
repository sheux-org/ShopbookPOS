import React from "react";
import { Stack } from "expo-router";
import { StocksScreen } from "../components/screens/StocksScreen";

export default function StocksRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StocksScreen />
    </>
  );
}
