import React from 'react';
import { Stack } from 'expo-router';
import { PaymentTenderScreen } from '@/components/screens/PaymentTenderScreen';

export default function PaymentTenderRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PaymentTenderScreen />
    </>
  );
}
