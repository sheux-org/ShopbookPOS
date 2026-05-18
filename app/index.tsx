import React, { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { cartState } from "../components/data/cartState";

export default function SessionGateRoute() {
  const [isLoggedIn, setIsLoggedIn] = useState(cartState.getIsLoggedIn());
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const { useAuthStore } = require("../stores/useAuthStore");
    
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
      const { useBusinessStore } = require("../stores/useBusinessStore");
      useBusinessStore.getState().loadBusinessesFromDb();
    }
  }, [hasHydrated, isLoggedIn]);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" }}>
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
