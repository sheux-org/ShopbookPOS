import React from "react";
import { Stack } from "expo-router";
import { ItemDetailsScreen } from "@/components/screens/ItemDetailsScreen";

export default function ItemDetailsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ItemDetailsScreen />
    </>
  );
}
