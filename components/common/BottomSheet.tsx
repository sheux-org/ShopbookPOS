import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Inner horizontal padding for the rounded sheet (default 20). Use 0 for edge-to-edge body content. */
  contentPaddingHorizontal?: number;
  /** Inner top padding below the sheet top radius (default 12). */
  contentPaddingTop?: number;
  /** Cap total sheet height (e.g. fraction of screen). Scroll should live inside children when used. */
  maxHeight?: number;
  /** Force the sheet to take the full calculated height instead of wrapping content */
  forceMaxHeight?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  contentPaddingHorizontal = 20,
  contentPaddingTop = 12,
  maxHeight,
  forceMaxHeight = false,
}) => {
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(visible);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 18,
          stiffness: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    // Animate closing before calling the parent onClose callback
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowModal(false);
      onClose();
    });
  };

  if (!showModal) return null;

  const calculatedMaxHeight = maxHeight ?? (SCREEN_HEIGHT - insets.top - 40);
  const dynamicMaxHeight = Math.max(120, calculatedMaxHeight - keyboardHeight);

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop fades in/out independently and stays 100% static */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: "#000",
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sheet container sits on top and slides up/down */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                transform: [{ translateY: sheetTranslateY }],
                paddingBottom: Math.max(insets.bottom, 16),
                paddingHorizontal: contentPaddingHorizontal,
                paddingTop: contentPaddingTop,
                maxHeight: dynamicMaxHeight,
              },
              forceMaxHeight && { height: dynamicMaxHeight },
            ]}
          >
            {/* Visual drag handle indictator */}
            <View style={styles.dragHandle} />

            {title ? (
              <View
                style={[
                  styles.sheetHeader,
                  contentPaddingHorizontal === 0 ? { paddingHorizontal: 16 } : null,
                ]}
              >
                <Text style={styles.sheetTitle}>{title}</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <Feather name="x" size={20} color={TOKENS.dark} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={[styles.sheetBody, forceMaxHeight && { flex: 1 }]}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  sheetContainer: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 24,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    // Allows inner components to render freely
  },
});
