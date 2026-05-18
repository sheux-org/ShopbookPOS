import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useCameraPermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import { TOKENS } from "../constants/tokens";

interface PermissionContextType {
  hasCameraAccess: boolean;
  requestCameraAccess: (onSuccess?: () => void) => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isPrimerOpen, setIsPrimerOpen] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const hasCameraAccess = permission?.granted || false;

  const requestCameraAccess = (onSuccess?: () => void) => {
    if (permission?.granted) {
      if (onSuccess) onSuccess();
      return;
    }

    // Save success callback and show beautiful global primer explaining why we need camera
    if (onSuccess) {
      setPendingCallback(() => onSuccess);
    }
    setIsPrimerOpen(true);
  };

  const handleSystemRequest = async () => {
    setIsRequesting(true);
    try {
      const response = await requestPermission();
      setIsRequesting(false);
      setIsPrimerOpen(false);
      
      if (response.granted && pendingCallback) {
        pendingCallback();
      }
      setPendingCallback(null);
    } catch (err) {
      console.error("System permission request failed:", err);
      setIsRequesting(false);
      setIsPrimerOpen(false);
      setPendingCallback(null);
    }
  };

  const handleCancel = () => {
    setIsPrimerOpen(false);
    setPendingCallback(null);
  };

  return (
    <PermissionContext.Provider value={{ hasCameraAccess, requestCameraAccess }}>
      {children}

      {/* Stunning Global Permission Primer Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isPrimerOpen}
        onRequestClose={handleCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            {/* Elegant Scanner Accent Illustration */}
            <View style={styles.iconCircle}>
              <Feather name="camera" size={32} color={TOKENS.primary} />
            </View>

            <Text style={styles.title}>Enable Camera Access</Text>
            
            <Text style={styles.description}>
              Shopbook requires camera authorization so you can dynamically scan product barcodes, lookup inventory prices, and complete cashier orders at lightning speed.
            </Text>

            {/* Actions */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.7}
                onPress={handleCancel}
                disabled={isRequesting}
              >
                <Text style={styles.cancelText}>Not Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.allowBtn}
                activeOpacity={0.8}
                onPress={handleSystemRequest}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <ActivityIndicator color={TOKENS.card} size="small" />
                ) : (
                  <>
                    <Text style={styles.allowText}>Allow Access</Text>
                    <Feather name="arrow-right" size={14} color={TOKENS.card} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </PermissionContext.Provider>
  );
};

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermission must be used within a PermissionProvider");
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)", // Sleek slate back-dim
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: TOKENS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    color: TOKENS.muted,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: TOKENS.muted,
  },
  allowBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 12,
    backgroundColor: TOKENS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  allowText: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.card,
  },
});
