import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { cartState } from '../components/data/cartState';
import { useAuthStore } from '../stores/useAuthStore';
import { useBusinessStore } from '../stores/useBusinessStore';
import { useEntitlementStore } from '../stores/useEntitlementStore';

export default function SessionGateRoute() {
  const [isLoggedIn, setIsLoggedIn] = useState(cartState.getIsLoggedIn());
  const [hasHydrated, setHasHydrated] = useState(false);
  const isPro = useEntitlementStore((s) => s.isPro);
  const checkedAt = useEntitlementStore((s) => s.checkedAt);
  const [entitlementTimedOut, setEntitlementTimedOut] = useState(false);

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

  // A session that has never resolved an entitlement waits for the first
  // refresh, but not forever: with no connectivity that check never returns,
  // and an unbounded wait leaves a till showing a spinner with no way out.
  // After the deadline we route on what we have, which sends an unverified
  // session to the paywall — where Restore and Log out are both reachable.
  useEffect(() => {
    if (checkedAt !== null) return;
    const timer = setTimeout(() => setEntitlementTimedOut(true), 2500);
    return () => clearTimeout(timer);
  }, [checkedAt]);

  useEffect(() => {
    if (!hasHydrated || !isLoggedIn) return;

    let isMounted = true;
    (async () => {
      await useBusinessStore.getState().loadBusinessesFromDb();
      if (!isMounted) return;

      const activeBizId = useAuthStore.getState().activeBusinessId;
      if (activeBizId && activeBizId !== '0') {
        await useEntitlementStore.getState().refresh(activeBizId);
      } else {
        setEntitlementTimedOut(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [hasHydrated, isLoggedIn]);

  if (!hasHydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/auth/number-input" />;
  }

  // Entitlement gate. The persisted cache decides the route so a paying shop
  // opens straight into the till and still works with no connectivity; the
  // refresh above corrects it in the background. Only a session that has
  // never resolved an entitlement waits, which avoids showing the paywall to
  // a subscriber for a frame on every cold start.
  if (checkedAt === null && !entitlementTimedOut) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <Redirect href={isPro ? '/(tabs)' : '/paywall'} />;
}
