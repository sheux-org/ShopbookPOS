import React from "react";
import { Stack } from "expo-router";
import { HomeScreen } from "../../components/screens/HomeScreen";

export default function IndexRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeScreen />
    </>
  );
}
