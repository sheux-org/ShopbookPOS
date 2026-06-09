import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { useCart } from '../stores/cartStore';
import { useCartActions } from './useCartActions';
import { requestFullPullForBusiness } from '../services/sync';

export function useAppAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { releaseReservedStocks } = useCartActions();

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const loadBusinessesFromDb = useBusinessStore((s) => s.loadBusinessesFromDb);

  const [hydrated, setHydrated] = useState(false);
  const [prevBizId, setPrevBizId] = useState<string | null>(null);

  // Zustand Hydration check
  useEffect(() => {
    setHydrated(useAuthStore.persist.hasHydrated());
    const unsubFinish = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return () => unsubFinish();
  }, []);

  // Initialize DB and load profiles on startup
  useEffect(() => {
    if (hydrated && isLoggedIn) {
      loadBusinessesFromDb();
    }
  }, [hydrated, isLoggedIn, loadBusinessesFromDb]);

  // Auth Guard
  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn && pathname !== '/auth') {
      router.push('/auth');
    } else if (isLoggedIn && pathname === '/auth') {
      router.push('/');
    }
  }, [hydrated, isLoggedIn, pathname, router]);

  // Restore stock and clear cart on logout or switching business
  useEffect(() => {
    if (hydrated) {
      if (!isLoggedIn || (prevBizId && activeBusiness?.id && activeBusiness.id !== prevBizId)) {
        const cart = useCart.getState().cart;
        const bizIdToRestore = prevBizId || activeBusiness?.id;
        if (cart.length > 0 && bizIdToRestore && bizIdToRestore !== '0') {
          releaseReservedStocks(cart, bizIdToRestore);
        } else {
          useCart.getState().clearCart();
        }
        if (
          isLoggedIn &&
          activeBusiness?.id &&
          activeBusiness.id !== prevBizId &&
          activeBusiness.id !== '0'
        ) {
          requestFullPullForBusiness(activeBusiness.id);
        }
      }
      setPrevBizId(activeBusiness?.id || null);
    }
  }, [hydrated, isLoggedIn, activeBusiness?.id]);

  return { hydrated, isLoggedIn, activeBusinessId, activeBusiness };
}
