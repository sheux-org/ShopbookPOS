import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../stores/useSettingsStore';

/**
 * Global Haptic feedback helper that respects the user's settings toggle.
 */
export const hapticFeedback = {
  /**
   * Subtle tactile feedback for button clicks, numeric keyboard inputs, or small actions.
   */
  impactLight: async () => {
    if (useSettingsStore.getState().hapticsEnabled) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Haptic impactLight failed:', error);
      }
    }
  },

  /**
   * Medium feedback for toggles, selections, or medium emphasis interactions.
   */
  impactMedium: async () => {
    if (useSettingsStore.getState().hapticsEnabled) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.warn('Haptic impactMedium failed:', error);
      }
    }
  },

  /**
   * Heavy feedback for significant changes or actions that require strong emphasis.
   */
  impactHeavy: async () => {
    if (useSettingsStore.getState().hapticsEnabled) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (error) {
        console.warn('Haptic impactHeavy failed:', error);
      }
    }
  },

  /**
   * Selection feedback for scrolling or shifting active selections.
   */
  selection: async () => {
    if (useSettingsStore.getState().hapticsEnabled) {
      try {
        await Haptics.selectionAsync();
      } catch (error) {
        console.warn('Haptic selection failed:', error);
      }
    }
  },

  /**
   * Success feedback for positive completion (e.g. order complete, successful upload).
   */
  notificationSuccess: async () => {
    if (useSettingsStore.getState().hapticsEnabled) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.warn('Haptic notificationSuccess failed:', error);
      }
    }
  },

  /**
   * Warning feedback for validation alerts or partial success warnings.
   */
  notificationWarning: async () => {
    if (useSettingsStore.getState().hapticsEnabled) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (error) {
        console.warn('Haptic notificationWarning failed:', error);
      }
    }
  },

  /**
   * Error feedback for failures, permission blocks, or invalid database events.
   */
  notificationError: async () => {
    if (useSettingsStore.getState().hapticsEnabled) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (error) {
        console.warn('Haptic notificationError failed:', error);
      }
    }
  },
};
