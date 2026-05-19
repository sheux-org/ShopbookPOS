import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../../constants/tokens";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useBusinessStore } from "../../../stores/useBusinessStore";
import * as Print from 'expo-print';

interface ScannedDevice {
  name: string;
  address: string;
  type: string;
}

const MOCK_DEVICES: ScannedDevice[] = [
  { name: "MPT-II (Thermal Receipt)", address: "00:11:22:33:44:55", type: "ESC/POS (58mm)" },
  { name: "POS-58 Bluetooth Printer", address: "AA:BB:CC:DD:EE:FF", type: "ESC/POS (58mm)" },
  { name: "XP-80 Thermal Printer", address: "12:34:56:78:90:AB", type: "ESC/POS (80mm)" },
];

export default function BluetoothPrinterRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const pairedPrinter = useSettingsStore((s) => s.pairedPrinter);
  const setPairedPrinter = useSettingsStore((s) => s.setPairedPrinter);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);

  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Virtual test print preview sheet
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleStartScan = () => {
    setIsScanning(true);
    setDevices([]);
    
    // Simulate Bluetooth discovery scan with delay
    setTimeout(() => {
      setDevices(MOCK_DEVICES);
      setIsScanning(false);
      triggerToast("Scan completed! Nearby devices found.");
    }, 2500);
  };

  const handleConnectDevice = (device: ScannedDevice) => {
    setConnectingDevice(device.name);
    
    // Simulate connection delay
    setTimeout(() => {
      setPairedPrinter(device.name);
      setConnectingDevice(null);
      triggerToast(`Connected to ${device.name} ✅`);
    }, 2000);
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Printer",
      "Are you sure you want to disconnect this thermal printer?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => {
            setPairedPrinter(null);
            setDevices([]);
            triggerToast("Printer disconnected");
          }
        }
      ]
    );
  };

  const handlePrintTestPage = async () => {
    if (!pairedPrinter) {
      Alert.alert("No Printer", "Please pair a thermal printer first.");
      return;
    }
    setShowReceiptPreview(true);
  };

  const executePhysicalPrint = async () => {
    // Generate beautiful receipt HTML containing store details
    const logoHtml = activeBusiness.logoUri 
      ? activeBusiness.logoUri.length <= 2 
        ? `<div style="font-size: 38px; text-align: center; margin-bottom: 5px;">${activeBusiness.logoUri}</div>`
        : `<div style="text-align: center; margin-bottom: 5px;"><img src="${activeBusiness.logoUri}" style="width: 60px; height: 60px; border-radius: 30px; object-fit: cover;" /></div>`
      : `<div style="font-size: 38px; text-align: center; margin-bottom: 5px;">🏠</div>`;

    const htmlContent = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              padding: 10px;
              color: #000;
              font-size: 14px;
            }
            .center { text-align: center; }
            .header-title { font-size: 18px; font-weight: bold; margin: 4px 0; }
            .separator { border-top: 1px dashed #000; margin: 10px 0; }
            .flex-row { display: flex; justify-content: space-between; margin: 4px 0; }
            .bold { font-weight: bold; }
            .barcode { font-size: 11px; text-align: center; margin-top: 15px; color: #555; }
          </style>
        </head>
        <body>
          ${logoHtml}
          <div class="center header-title">${activeBusiness.name}</div>
          <div class="center">${activeBusiness.category}</div>
          <div class="center">${activeBusiness.address}</div>
          <div class="center">Tel: ${activeBusiness.phone}</div>
          
          <div class="separator"></div>
          
          <div class="center bold">*** TEST PRINT RECEIPT ***</div>
          <div class="center">Printer: ${pairedPrinter}</div>
          <div class="center">Connection Status: ONLINE</div>
          
          <div class="separator"></div>
          
          <div class="flex-row">
            <span>1x Anchor Milk 1L</span>
            <span>Rs. 680.00</span>
          </div>
          <div class="flex-row">
            <span>2x Marie Biscuits</span>
            <span>Rs. 360.00</span>
          </div>
          
          <div class="separator"></div>
          
          <div class="flex-row bold">
            <span>Subtotal</span>
            <span>Rs. 1,040.00</span>
          </div>
          <div class="flex-row">
            <span>Standard Tax (8%)</span>
            <span>Rs. 83.20</span>
          </div>
          <div class="flex-row bold" style="font-size: 16px;">
            <span>TOTAL</span>
            <span>Rs. 1,123.20</span>
          </div>
          
          <div class="separator"></div>
          <div class="center">Thank you for visiting!</div>
          <div class="center">Powered by Shopbook POS</div>
          <div class="barcode">|||| | ||||| | ||| ||||||| 0192381</div>
        </body>
      </html>
    `;

    try {
      await Print.printAsync({ html: htmlContent });
      setShowReceiptPreview(false);
      triggerToast("Test page sent to printer! 🖨️");
    } catch (error) {
      console.error(error);
      Alert.alert("Print Error", "Could not complete printing operation.");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/profile")}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Printer Setup</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollWrapper}>
        {/* Connection status section */}
        {pairedPrinter ? (
          <View style={styles.pairedCard}>
            <View style={styles.pairedIconBox}>
              <Feather name="printer" size={28} color="#137333" />
            </View>
            <View style={styles.pairedInfo}>
              <Text style={styles.pairedTitle}>{pairedPrinter}</Text>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Connected & Ready</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
              <Text style={styles.disconnectBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noPrinterCard}>
            <View style={styles.noPrinterIconBox}>
              <Feather name="printer" size={32} color={TOKENS.muted} />
            </View>
            <Text style={styles.noPrinterTitle}>No Printer Connected</Text>
            <Text style={styles.noPrinterSub}>
              Connect a Bluetooth 58mm or 80mm ESC/POS thermal printer to generate instant paper bills.
            </Text>
          </View>
        )}

        {/* Action Panel */}
        {pairedPrinter && (
          <View style={styles.actionPanel}>
            <Text style={styles.sectionTitle}>Printer Actions</Text>
            <TouchableOpacity style={styles.actionRowBtn} onPress={handlePrintTestPage}>
              <View style={[styles.actionIconCircle, { backgroundColor: TOKENS.lightBlue }]}>
                <Feather name="file-text" size={18} color={TOKENS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionRowTitle}>Print Test Page</Text>
                <Text style={styles.actionRowSub}>Send test invoice layout to verify print alignments</Text>
              </View>
              <Feather name="chevron-right" size={16} color={TOKENS.muted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Scan section */}
        <View style={styles.scanSection}>
          <View style={styles.scanHeader}>
            <Text style={styles.sectionTitle}>Available Devices</Text>
            {isScanning && <ActivityIndicator size="small" color={TOKENS.primary} />}
          </View>

          {!isScanning && devices.length === 0 && (
            <TouchableOpacity 
              style={styles.scanBtn}
              activeOpacity={0.8}
              onPress={handleStartScan}
            >
              <Feather name="search" size={16} color={TOKENS.card} />
              <Text style={styles.scanBtnText}>Scan for Bluetooth Printers</Text>
            </TouchableOpacity>
          )}

          {isScanning && (
            <View style={styles.scanningBox}>
              <Text style={styles.scanningText}>Searching for Bluetooth peripherals...</Text>
              <Text style={styles.scanningSub}>Make sure your receipt printer is switched on and discoverable.</Text>
            </View>
          )}

          {!isScanning && devices.length > 0 && (
            <View style={styles.deviceList}>
              {devices.map((device) => {
                const isConnecting = connectingDevice === device.name;
                return (
                  <TouchableOpacity
                    key={device.address}
                    style={styles.deviceRow}
                    disabled={connectingDevice !== null}
                    onPress={() => handleConnectDevice(device)}
                  >
                    <View style={styles.deviceIconCircle}>
                      <Ionicons name="bluetooth" size={18} color={TOKENS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceDetails}>{device.type} · Mac: {device.address}</Text>
                    </View>
                    {isConnecting ? (
                      <ActivityIndicator size="small" color={TOKENS.primary} />
                    ) : (
                      <Text style={styles.connectLink}>Pair Device</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              
              <TouchableOpacity style={styles.rescanBtn} onPress={handleStartScan}>
                <Feather name="refresh-cw" size={14} color={TOKENS.primary} />
                <Text style={styles.rescanText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* VIRTUAL RECEIPT PREVIEW MODAL */}
      <Modal
        visible={showReceiptPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceiptPreview(false)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Virtual Printer Output</Text>
              <TouchableOpacity onPress={() => setShowReceiptPreview(false)}>
                <Feather name="x" size={20} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>

            {/* Simulated Receipt Feed */}
            <ScrollView style={styles.receiptScroll} contentContainerStyle={styles.receiptContent}>
              <View style={styles.receiptLogoWrapper}>
                {activeBusiness.logoUri ? (
                  activeBusiness.logoUri.length <= 2 ? (
                    <Text style={{ fontSize: 32 }}>{activeBusiness.logoUri}</Text>
                  ) : (
                    <Image source={{ uri: activeBusiness.logoUri }} style={styles.receiptLogoImg} />
                  )
                ) : (
                  <Text style={{ fontSize: 32 }}>🏠</Text>
                )}
              </View>
              
              <Text style={styles.receiptStoreName}>{activeBusiness.name}</Text>
              <Text style={styles.receiptStoreSub}>{activeBusiness.category}</Text>
              <Text style={styles.receiptStoreSub}>{activeBusiness.address}</Text>
              <Text style={styles.receiptStoreSub}>Tel: {activeBusiness.phone}</Text>
              
              <Text style={styles.dashedSeparator}>- - - - - - - - - - - - - - - -</Text>
              <Text style={[styles.receiptStoreSub, { fontWeight: "bold", textAlign: "center" }]}>
                *** TEST PRINT RECEIPT ***
              </Text>
              <Text style={styles.receiptStoreSub}>Printer: {pairedPrinter}</Text>
              <Text style={styles.receiptStoreSub}>Status: ONLINE</Text>
              <Text style={styles.dashedSeparator}>- - - - - - - - - - - - - - - -</Text>

              <View style={styles.receiptItemRow}>
                <Text style={styles.receiptItemName}>1x Anchor Milk 1L</Text>
                <Text style={styles.receiptItemPrice}>Rs. 680.00</Text>
              </View>

              <View style={styles.receiptItemRow}>
                <Text style={styles.receiptItemName}>2x Marie Biscuits</Text>
                <Text style={styles.receiptItemPrice}>Rs. 360.00</Text>
              </View>
              
              <Text style={styles.dashedSeparator}>- - - - - - - - - - - - - - - -</Text>

              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>Subtotal</Text>
                <Text style={styles.receiptTotalVal}>Rs. 1,040.00</Text>
              </View>
              
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>Standard Tax (8%)</Text>
                <Text style={styles.receiptTotalVal}>Rs. 83.20</Text>
              </View>

              <View style={[styles.receiptTotalRow, { marginTop: 4 }]}>
                <Text style={[styles.receiptTotalLabel, { fontWeight: "bold", fontSize: 15 }]}>TOTAL</Text>
                <Text style={[styles.receiptTotalVal, { fontWeight: "bold", fontSize: 15 }]}>Rs. 1,123.20</Text>
              </View>

              <Text style={styles.dashedSeparator}>- - - - - - - - - - - - - - - -</Text>
              
              <Text style={[styles.receiptStoreSub, { textAlign: "center", fontStyle: "italic" }]}>
                Thank you for visiting!
              </Text>
              <Text style={[styles.receiptStoreSub, { textAlign: "center" }]}>Powered by Shopbook POS</Text>

              {/* Mock Barcode */}
              <View style={styles.barcodeBox}>
                <View style={styles.barcodeLines} />
                <Text style={styles.barcodeText}>|||| | ||||| | ||| ||||||| 0192381</Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.printActionBtn} 
              activeOpacity={0.8}
              onPress={executePhysicalPrint}
            >
              <Feather name="printer" size={16} color={TOKENS.card} />
              <Text style={styles.printActionBtnText}>Trigger Hardware Print (expo-print)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  toastContainer: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    backgroundColor: TOKENS.success,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
    position: "absolute",
    left: 60,
    right: 60,
    textAlign: "center",
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  pairedCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  pairedIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  pairedInfo: {
    flex: 1,
  },
  pairedTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#137333",
  },
  onlineText: {
    fontSize: 11,
    color: "#137333",
    fontWeight: "bold",
  },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  disconnectBtnText: {
    color: TOKENS.error,
    fontSize: 12,
    fontWeight: "bold",
  },
  noPrinterCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 24,
    alignItems: "center",
  },
  noPrinterIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  noPrinterTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  noPrinterSub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 16,
  },
  actionPanel: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: TOKENS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actionRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionRowTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  actionRowSub: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
  },
  scanSection: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    gap: 12,
  },
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TOKENS.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  scanBtnText: {
    color: TOKENS.card,
    fontSize: 14,
    fontWeight: "bold",
  },
  scanningBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  scanningText: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  scanningSub: {
    fontSize: 11,
    color: TOKENS.muted,
    textAlign: "center",
    marginTop: 6,
  },
  deviceList: {
    gap: 12,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  deviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  deviceDetails: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
  },
  connectLink: {
    fontSize: 12,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  rescanText: {
    color: TOKENS.primary,
    fontSize: 13,
    fontWeight: "bold",
  },
  // Preview modal styles
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewCard: {
    backgroundColor: TOKENS.card,
    width: "100%",
    borderRadius: 24,
    padding: 20,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  receiptScroll: {
    backgroundColor: "#FDFDFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    flexGrow: 0,
  },
  receiptContent: {
    alignItems: "stretch",
    paddingBottom: 24,
  },
  receiptLogoWrapper: {
    alignSelf: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  receiptLogoImg: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
  },
  receiptStoreName: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    color: "#000",
  },
  receiptStoreSub: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    textAlign: "center",
    color: "#444",
    marginTop: 2,
  },
  dashedSeparator: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    textAlign: "center",
    color: "#000",
    marginVertical: 8,
  },
  receiptItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  receiptItemName: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#000",
  },
  receiptItemPrice: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#000",
  },
  receiptTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  receiptTotalLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#000",
  },
  receiptTotalVal: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#000",
  },
  barcodeBox: {
    alignItems: "center",
    marginTop: 20,
    gap: 4,
  },
  barcodeLines: {
    width: 140,
    height: 32,
    backgroundColor: "#000",
    opacity: 0.85,
  },
  barcodeText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#666",
  },
  printActionBtn: {
    backgroundColor: TOKENS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  printActionBtnText: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 14,
  },
});
