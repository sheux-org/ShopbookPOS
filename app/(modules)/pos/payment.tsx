import React from "react";
import { Stack } from "expo-router";
import { PaymentScreen } from "@/components/screens/PaymentScreen";

export default function PaymentRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PaymentScreen />
    </>
  );
}
