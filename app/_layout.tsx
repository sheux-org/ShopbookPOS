import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/number-input" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(pos)/cart" />
        <Stack.Screen name="(pos)/catalog" />
        <Stack.Screen name="(pos)/payment" />
        <Stack.Screen name="(pos)/payment-tender" />
        <Stack.Screen name="(pos)/search" />
        <Stack.Screen name="(stocks)/add-item" />
        <Stack.Screen name="(stocks)/scan" />
        <Stack.Screen name="profile/business-details" />
        <Stack.Screen name="profile/manage-businesses" />
        <Stack.Screen name="profile/manage-staff" />
      </Stack>
    </SafeAreaProvider>
  );
}
