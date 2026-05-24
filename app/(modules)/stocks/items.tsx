import React from "react";
import { Stack } from "expo-router";
import { ManageItemsScreen } from "@/components/screens/ManageItemsScreen";

export default function ManageItemsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ManageItemsScreen />
    </>
  );
}
