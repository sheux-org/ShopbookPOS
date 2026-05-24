import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { cartState } from "../components/data/cartState";
import { useAuthStore } from "../stores/useAuthStore";
import { useBusinessStore } from "../stores/useBusinessStore";

export default function SessionGateRoute() {
  const [isLoggedIn, setIsLoggedIn] = useState(cartState.getIsLoggedIn());
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const checkHydration = () => {
      if (useAuthStore.persist.hasHydrated()) {
        setHasHydrated(true);
        setIsLoggedIn(cartState.getIsLoggedIn());
      }
    };

    checkHydration();

    const unsubFinish = useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
      setIsLoggedIn(cartState.getIsLoggedIn());
    });

    const unsubBridge = cartState.subscribe(() => {
      setIsLoggedIn(cartState.getIsLoggedIn());
    });

    return () => {
      unsubFinish();
      unsubBridge();
    };
  }, []);

  useEffect(() => {
    if (hasHydrated && isLoggedIn) {
      useBusinessStore.getState().loadBusinessesFromDb();
    }
  }, [hasHydrated, isLoggedIn]);

  if (!hasHydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (isLoggedIn) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/auth/number-input" />;
  }
}
