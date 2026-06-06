import { Platform, StatusBar } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

/** Reliable top inset on Android edge-to-edge (fallback when insets.top is 0). */
export function getTopSafeInset(insets: EdgeInsets): number {
  if (insets.top > 0) return insets.top;
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? 24;
  }
  return 0;
}
