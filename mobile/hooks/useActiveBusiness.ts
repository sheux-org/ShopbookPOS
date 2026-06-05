import { useBusinessStore } from '../stores/useBusinessStore';

/** Reactive active business — re-renders when the user switches branches. */
export function useActiveBusiness() {
  return useBusinessStore((s) => s.activeBusiness);
}
