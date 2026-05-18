import React from "react";
import { Stack } from "expo-router";
import { CatalogScreen } from "../../components/screens/CatalogScreen";

export default function CatalogRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CatalogScreen />
    </>
  );
}
