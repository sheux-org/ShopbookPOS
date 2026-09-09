import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { cartState } from '../components/data/cartState';
import { useAuthStore } from '../stores/useAuthStore';
import { useBusinessStore } from '../stores/useBusinessStore';
import { useEntitlementStore } from '../stores/useEntitlementStore';

export default function SessionGateRoute() {
  const [isLoggedIn, setIsLoggedIn] = useState(cartState.getIsLoggedIn());
  const [hasAuthHydrated, setHasAuthHydrated] = useState(useAuthStore.persist.hasHydrated());
  const [hasEntitlementHydrated, setHasEntitlementHydrated] = useState(
    useEntitlementStore.persist.hasHydrated()
  );
  const isPro = useEntitlementStore((s) => s.isPro);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHasAuthHydrated(true);
      setIsLoggedIn(cartState.getIsLoggedIn());
    }
    const unsubAuth = useAuthStore.persist.onFinishHydration(() => {
      setHasAuthHydrated(true);
      setIsLoggedIn(cartState.getIsLoggedIn());
    });

    if (useEntitlementStore.persist.hasHydrated()) {
      setHasEntitlementHydrated(true);
    }
    const unsubEntitlement = useEntitlementStore.persist.onFinishHydration(() => {
      setHasEntitlementHydrated(true);
    });

    const unsubBridge = cartState.subscribe(() => {
      setIsLoggedIn(cartState.getIsLoggedIn());
    });

    return () => {
      unsubAuth();
      unsubEntitlement();
      unsubBridge();
    };
  }, []);

  const hasHydrated = hasAuthHydrated && hasEntitlementHydrated;

  // Non-blocking background sync (Stale-While-Revalidate):
  // Synchronizes business records and refreshes entitlement from the server
  // asynchronously in the background without blocking the UI or route transition.
  useEffect(() => {
    if (!hasHydrated || !isLoggedIn) return;

    let isMounted = true;
    (async () => {
      try {
        await useBusinessStore.getState().loadBusinessesFromDb();
        if (!isMounted) return;

        const activeBizId = useAuthStore.getState().activeBusinessId;
        if (activeBizId && activeBizId !== '0') {
          await useEntitlementStore.getState().refresh(activeBizId);
        }
      } catch (err) {
        console.warn('[SessionGate] Background sync error:', err);
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

  return <Redirect href={isPro ? '/(tabs)' : '/paywall'} />;
}
