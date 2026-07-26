import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Animated, Easing } from 'react-native';
import { CameraView } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '../../constants/tokens';
import { usePermission } from '../../hooks/usePermissionHandler';

export interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (data: string) => void;
  title?: string;
  instruction?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onBarcodeScanned,
  title = '📷 Barcode Scanner Active',
  instruction = 'Align the retail product barcode within the viewfinder to automatically scan and catalog',
}) => {
  const { hasCameraAccess, requestCameraAccess } = usePermission();
  const scanAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && !hasCameraAccess) {
      requestCameraAccess();
    }
  }, [visible, hasCameraAccess]);

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (visible) {
      scanAnim.setValue(0);
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      scanAnim.setValue(0);
    }
    return () => {
      if (anim) {
        anim.stop();
      }
    };
  }, [visible, scanAnim]);

  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 96],
  });

  if (!visible) return null;

  return (
    <View
      style={[
        styles.scannerBg,
        {
          top: -insets.top - 50,
          bottom: -insets.bottom - 50,
        },
      ]}
    >
      <View style={styles.scannerCard}>
        <View style={styles.scannerHeaderRow}>
          <Text style={styles.scannerTitle}>{title}</Text>
          <TouchableOpacity style={styles.closeScannerBtn} onPress={onClose}>
            <Feather name="x" size={20} color={TOKENS.dark} />
          </TouchableOpacity>
        </View>

        <Text style={styles.scannerInstruction}>{instruction}</Text>

        {/* Viewfinder area containing live CameraView */}
        <View style={styles.scannerViewfinder}>
          {hasCameraAccess ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{
                barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'qr', 'code128', 'code39'],
              }}
              onBarcodeScanned={({ data }) => {
                if (data) {
                  onBarcodeScanned(data);
                }
              }}
            />
          ) : (
            <View style={styles.permissionRequiredContainer}>
              <Text style={styles.permissionText}>Camera Access Required</Text>
              <TouchableOpacity onPress={() => requestCameraAccess()} style={styles.permissionBtn}>
                <Text style={styles.permissionBtnText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Viewfinder corners overlay */}
          <View style={[styles.viewfinderCorner, styles.cornerTL]} />
          <View style={[styles.viewfinderCorner, styles.cornerTR]} />
          <View style={[styles.viewfinderCorner, styles.cornerBL]} />
          <View style={[styles.viewfinderCorner, styles.cornerBR]} />

          {/* Animated Laser line */}
          <Animated.View
            style={[styles.scannerLaserLine, { transform: [{ translateY: laserTranslateY }] }]}
          />

          <Text style={styles.scanningText}>SCANNING...</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  scannerBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 99999,
  },
  scannerCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 16,
    boxShadow: '0px 8px 12px 0px rgba(0, 0, 0, 0.25)',
  },
  scannerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  closeScannerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerInstruction: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
  scannerViewfinder: {
    width: '100%',
    height: 100,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.3)',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  viewfinderCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: TOKENS.yellow,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scannerLaserLine: {
    position: 'absolute',
    width: '90%',
    height: 2,
    backgroundColor: TOKENS.yellow,
    boxShadow: `0px 0px 3px 0px ${TOKENS.yellow}CC`,
    top: 2,
  },
  scanningText: {
    position: 'absolute',
    bottom: 10,
    fontSize: 10,
    fontWeight: 'bold',
    color: TOKENS.yellow,
    letterSpacing: 1.5,
  },
  permissionRequiredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: '100%',
    height: '100%',
  },
  permissionText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionBtn: {
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
