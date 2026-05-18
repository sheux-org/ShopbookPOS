import React from "react";
import { Stack } from "expo-router";
import { SearchScreen } from "../components/screens/SearchScreen";

export default function SearchRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SearchScreen />
    </>
  );
}
