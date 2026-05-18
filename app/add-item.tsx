import React from "react";
import { Stack } from "expo-router";
import { AddItemScreen } from "../components/screens/AddItemScreen";

export default function AddItemRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AddItemScreen />
    </>
  );
}
