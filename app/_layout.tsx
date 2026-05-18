import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(modules)/auth/number-input" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(modules)/pos/cart" />
        <Stack.Screen name="(modules)/pos/catalog" />
        <Stack.Screen name="(modules)/pos/payment" />
        <Stack.Screen name="(modules)/pos/payment-tender" />
        <Stack.Screen name="(modules)/pos/search" />
        <Stack.Screen name="(modules)/stocks/add-item" />
        <Stack.Screen name="(modules)/stocks/scan" />
        <Stack.Screen name="(modules)/profile/business-details" />
        <Stack.Screen name="(modules)/profile/manage-businesses" />
        <Stack.Screen name="(modules)/profile/manage-staff" />
      </Stack>
    </SafeAreaProvider>
  );
}
