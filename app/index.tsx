import React, { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import { cartState } from "../components/data/cartState";

export default function SessionGateRoute() {
  const [isLoggedIn, setIsLoggedIn] = useState(cartState.getIsLoggedIn());

  useEffect(() => {
    const syncState = () => {
      setIsLoggedIn(cartState.getIsLoggedIn());
    };
    return cartState.subscribe(syncState);
  }, []);

  if (isLoggedIn) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/number-input" />;
  }
}
