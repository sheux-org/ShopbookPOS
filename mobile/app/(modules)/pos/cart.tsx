import React from 'react';
import { Stack } from 'expo-router';
import { CartScreen } from '@/components/screens/CartScreen';

export default function CartRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CartScreen />
    </>
  );
}
