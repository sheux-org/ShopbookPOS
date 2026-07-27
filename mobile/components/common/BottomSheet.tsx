import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useWindowDimensions,
  Keyboard,
  Platform,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFooter,
  BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '../../constants/tokens';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footerComponent?: React.ReactNode;
  contentPaddingHorizontal?: number;
  contentPaddingTop?: number;
  maxHeight?: number;
  forceMaxHeight?: boolean;
  snapPoints?: (string | number)[];
  enableDynamicSizing?: boolean;
  useScrollView?: boolean;
}

// Memory leakage / Re-render පාලනය සඳහා Custom Backdrop Memoization
const CustomBackdrop = memo((props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
    opacity={0.5}
    pressBehavior="close"
  />
));

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  footerComponent,
  contentPaddingHorizontal = 16,
  contentPaddingTop = 12,
  maxHeight,
  forceMaxHeight = false,
  snapPoints,
  enableDynamicSizing = true,
  useScrollView = true,
}) => {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const bottomSheetModalRef = useRef<BottomSheetModal | null>(null);
  const isPresentedRef = useRef<boolean>(false);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const topInset = Math.max(insets.top, 24);
  const maxAvailableHeight = maxHeight ?? screenHeight - topInset - 24;

  const usingDynamicSizing =
    !snapPoints && !forceMaxHeight && enableDynamicSizing && !useScrollView;

  const computedSnapPoints =
    snapPoints ??
    (forceMaxHeight ? [maxAvailableHeight] : usingDynamicSizing ? undefined : ['75%', '92%']);

  const presentModal = useCallback(() => {
    if (bottomSheetModalRef.current && !isPresentedRef.current) {
      isPresentedRef.current = true;
      bottomSheetModalRef.current.present();
    }
  }, []);

  const dismissModal = useCallback(() => {
    if (bottomSheetModalRef.current && isPresentedRef.current) {
      isPresentedRef.current = false;
      bottomSheetModalRef.current.dismiss();
    }
  }, []);

  useEffect(() => {
    if (visible) {
      presentModal();
    } else {
      dismissModal();
    }
  }, [visible, presentModal, dismissModal]);

  const handleDismiss = useCallback(() => {
    isPresentedRef.current = false;
    onClose();
  }, [onClose]);

  const handleAnimate = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex === -1) {
      Keyboard.dismiss();
    }
  }, []);

  // Memoized Footer Component
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      if (!footerComponent) return null;
      return (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View
            style={[
              styles.footerWrapper,
              {
                paddingHorizontal: contentPaddingHorizontal,
                paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom + 12, 24),
              },
            ]}
          >
            {footerComponent}
          </View>
        </BottomSheetFooter>
      );
    },
    [footerComponent, contentPaddingHorizontal, insets.bottom, isKeyboardVisible]
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      onDismiss={handleDismiss}
      snapPoints={computedSnapPoints}
      enableDynamicSizing={usingDynamicSizing}
      maxDynamicContentSize={maxAvailableHeight}
      backdropComponent={CustomBackdrop}
      footerComponent={footerComponent ? renderFooter : undefined}
      enablePanDownToClose={true}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={styles.dragHandle}
      backgroundStyle={styles.backgroundStyle}
      enableOverDrag={false}
      animateOnMount
      onAnimate={handleAnimate}
    >
      <BottomSheetView
        style={[
          styles.sheetView,
          {
            paddingHorizontal: contentPaddingHorizontal,
            paddingTop: contentPaddingTop,
            paddingBottom: footerComponent ? 0 : Math.max(insets.bottom + 12, 28),
          },
        ]}
      >
        {title ? (
          <View
            style={[
              styles.sheetHeader,
              contentPaddingHorizontal === 0 && styles.headerPaddingFallback,
            ]}
          >
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={dismissModal} style={styles.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color={TOKENS.dark} />
            </TouchableOpacity>
          </View>
        ) : null}

        {useScrollView ? (
          <BottomSheetScrollView
            style={styles.scrollViewFlex}
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </BottomSheetScrollView>
        ) : (
          <View style={styles.sheetBody}>{children}</View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export { BottomSheetView, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';

const styles = StyleSheet.create({
  backgroundStyle: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
  },
  sheetView: {
    width: '100%',
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerPaddingFallback: {
    paddingHorizontal: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    width: '100%',
  },
  scrollViewFlex: {
    width: '100%',
  },
  footerWrapper: {
    width: '100%',
    backgroundColor: TOKENS.card,
    paddingTop: 10,
  },
});
