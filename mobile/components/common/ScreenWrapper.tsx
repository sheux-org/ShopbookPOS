import React from 'react';
import { KeyboardAvoidingView, Platform, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '../../constants/tokens';
import { getTopSafeInset } from '../../utils/safeArea';

interface ScreenWrapperProps {
  children: React.ReactNode;
  /**
   * Set to true on screens that contain TextInputs so KeyboardAvoidingView
   * will shift/pad content above the keyboard automatically.
   */
  withKeyboard?: boolean;
  /**
   * Override the background colour (defaults to TOKENS.background).
   */
  backgroundColor?: string;
  /**
   * Extra bottom padding to add on top of safe area bottom inset.
   * Useful for screens that sit behind a custom tab bar.
   */
  extraBottomPad?: number;
  /**
   * Set to true when the screen manages its own bottom inset (e.g. has a FAB
   * or FlatList that adds its own paddingBottom from insets).
   * This prevents double-counting the safe area bottom inset.
   */
  noPaddingBottom?: boolean;
  style?: ViewStyle;
}

/**
 * ScreenWrapper
 * -------------
 * Drop-in replacement for the raw <View> container used on every screen.
 * It handles:
 *  - iOS / Android safe area insets (top, bottom) correctly
 *  - KeyboardAvoidingView so inputs are never hidden behind the soft keyboard
 *
 * Usage:
 *   <ScreenWrapper withKeyboard>
 *     ...screen content...
 *   </ScreenWrapper>
 */
export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  withKeyboard = false,
  backgroundColor = TOKENS.background,
  extraBottomPad = 0,
  noPaddingBottom = false,
  style,
}) => {
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
    // Respect the status bar / notch at the top (Android edge-to-edge included)
    paddingTop: getTopSafeInset(insets),
    // Respect the home indicator / nav bar at the bottom
    paddingBottom: noPaddingBottom ? 0 : insets.bottom + extraBottomPad,
  };

  if (withKeyboard) {
    return (
      <KeyboardAvoidingView
        style={[containerStyle, style]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
};
