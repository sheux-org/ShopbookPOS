import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Keyboard,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenWrapper } from "../common/ScreenWrapper";
import { TOKENS } from "../../constants/tokens";
import { cartState } from "../data/cartState";
import { useCreateOrder } from "../../hooks/useOrders";
import { useAuthStore } from "../../stores/useAuthStore";
import { useBusinessStore } from "../../stores/useBusinessStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import * as Print from "expo-print";
import { BottomSheet } from "../common/BottomSheet";
import { hapticFeedback } from "../../utils/haptics";

type TenderMethod = "cash" | "card";

const SRI_LANKAN_BANKS = [
  "Bank of Ceylon (BOC)",
  "People's Bank",
  "Commercial Bank",
  "Hatton National Bank (HNB)",
  "Sampath Bank",
  "Seylan Bank",
  "Nations Trust Bank (NTB)",
  "DFCC Bank",
  "National Savings Bank (NSB)",
  "Pan Asia Bank",
  "Union Bank",
  "Amana Bank",
  "Cargills Bank",
  "Sanasa Development Bank (SDB)",
  "Regional Development Bank (RDB)",
];

export const PaymentTenderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const totalAmount = parseFloat(params.totalAmount as string) || 2905;
  const subtotal = parseFloat(params.subtotal as string) || totalAmount;
  const discountAmount = parseFloat(params.discount as string) || 0;
  const discountType = (params.discountType as string) || undefined;
  const discountValue = params.discountValue ? parseFloat(params.discountValue as string) : undefined;
  const taxAmount = parseFloat(params.tax as string) || 0;
  const taxRate = params.taxRate ? parseFloat(params.taxRate as string) : 0;
  const initialMethod = (params.paymentMethod as TenderMethod) || "cash";

  const [activeMethod, setActiveMethod] = useState<TenderMethod>(initialMethod);
  const [tenderedVal, setTenderedVal] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [lastFourDigits, setLastFourDigits] = useState("");
  const [showBankSheet, setShowBankSheet] = useState(false);

  // Dynamic values
  const parsedTendered = useMemo(() => {
    return parseFloat(tenderedVal) || 0;
  }, [tenderedVal]);

  const changeDue = useMemo(() => {
    if (parsedTendered <= totalAmount) return 0;
    return parsedTendered - totalAmount;
  }, [parsedTendered, totalAmount]);

  const handleNumPress = (val: string) => {
    hapticFeedback.impactLight();
    if (val === "backspace") {
      setTenderedVal((prev) => prev.slice(0, -1));
    } else {
      if (tenderedVal.length < 7) {
        setTenderedVal((prev) => prev + val);
      }
    }
  };

  const handleAddQuickCash = (amount: number) => {
    hapticFeedback.impactLight();
    setTenderedVal((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + amount).toString();
    });
  };

  const handleExactMatch = () => {
    hapticFeedback.impactMedium();
    setTenderedVal(totalAmount.toString());
  };

  const createOrderMutation = useCreateOrder();
  const activeBiz = useBusinessStore((state) => state.activeBusiness);
  const authStore = useAuthStore();
  const cashierName = authStore.employeeName || "Owner / Admin";
  const pairedPrinter = useSettingsStore((s) => s.pairedPrinter);

  const handleCompleteSale = () => {
    if (activeMethod === "cash" && parsedTendered < totalAmount) {
      hapticFeedback.notificationWarning();
      Alert.alert("Insufficient Tender", `Amount tendered must be at least Rs. ${totalAmount.toLocaleString()}`);
      return;
    }

    if (activeMethod === "card") {
      if (!selectedBank) {
        hapticFeedback.notificationWarning();
        Alert.alert("Bank Required", "Please select a Sri Lankan bank to complete the card transaction.");
        return;
      }
      if (lastFourDigits.length !== 4) {
        hapticFeedback.notificationWarning();
        Alert.alert("Card Number Required", "Please enter the last 4 digits of the card.");
        return;
      }
    }
    
    const cart = cartState.getCart().map(item => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    createOrderMutation.mutate({
      totalAmount,
      cashierName,
      businessId: activeBiz.id,
      paymentMethod: activeMethod,
      bankName: activeMethod === "card" ? selectedBank : undefined,
      cardLastFour: activeMethod === "card" ? lastFourDigits : undefined,
      discountType,
      discountValue,
      taxRate,
      taxValue: taxAmount,
      cart,
    }, {
      onSuccess: () => {
        hapticFeedback.notificationSuccess();
        setShowSuccessModal(true);
      },
      onError: (err) => {
        console.error("Failed to execute SQLite order transaction via React Query:", err);
        hapticFeedback.notificationSuccess();
        setShowSuccessModal(true);
      }
    });
  };

  const handlePrintReceipt = async () => {
    const cart = cartState.getCart();
    
    const logoHtml = activeBiz.logoUri 
      ? activeBiz.logoUri.length <= 2 
        ? `<div style="font-size: 38px; text-align: center; margin-bottom: 5px;">${activeBiz.logoUri}</div>`
        : `<div style="text-align: center; margin-bottom: 5px;"><img src="${activeBiz.logoUri}" style="width: 60px; height: 60px; border-radius: 30px; object-fit: cover;" /></div>`
      : `<div style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 8px; font-family: monospace; color: #000; letter-spacing: 2px;">★ MINI POS ★</div>`;

    const itemsHtml = cart.map(item => `
      <div class="flex-row">
        <span>${item.quantity}x ${item.name}</span>
        <span>Rs. ${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join("");

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
          <div class="center header-title">${activeBiz.name}</div>
          <div class="center">${activeBiz.category}</div>
          <div class="center">${activeBiz.address}</div>
          <div class="center">Tel: ${activeBiz.phone}</div>
          
          <div class="separator"></div>
          
          <div class="flex-row">
            <span>Cashier</span>
            <span>${cashierName}</span>
          </div>
          <div class="flex-row">
            <span>Payment Method</span>
            <span>${activeMethod.toUpperCase()}</span>
          </div>
          
          <div class="separator"></div>
          
          ${itemsHtml}
          
          <div class="separator"></div>
          
          <div class="flex-row bold">
            <span>Subtotal</span>
            <span>Rs. ${subtotal.toFixed(2)}</span>
          </div>
          ${discountAmount > 0 ? `
          <div class="flex-row">
            <span>Discount${discountType === "percentage" ? ` (${discountValue}%)` : ""}</span>
            <span>- Rs. ${discountAmount.toFixed(2)}</span>
          </div>
          ` : ""}
          <div class="flex-row">
            <span>${taxRate > 0 ? `Tax (${taxRate}%)` : "Tax"}</span>
            <span>Rs. ${taxAmount.toFixed(2)}</span>
          </div>
          <div class="flex-row bold" style="font-size: 16px;">
            <span>TOTAL</span>
            <span>Rs. ${totalAmount.toFixed(2)}</span>
          </div>
          
          <div class="separator"></div>
          <div class="center">Thank you for visiting!</div>
          <div class="center">Powered by Mini POS</div>
          <div class="barcode">|||| | ||||| | ||| ||||||| 0192381</div>
        </body>
      </html>
    `;

    try {
      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      console.error(error);
      Alert.alert("Print Error", "Could not complete printing operation.");
    }
  };

  const handleFinishSuccess = () => {
    setShowSuccessModal(false);
    cartState.clearCart(); // clear invoice cart
    router.push("/pos");  // redirect back to POS home page
  };

  return (
    <ScreenWrapper noPaddingBottom withKeyboard={activeMethod === "card"} style={styles.container}>
      
      {/* Header exactly matching Image 5 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>
            {activeMethod === "cash" ? "Cash" : "Card Payment"}
          </Text>
          <Text style={styles.headerSubtitle}>Total · Rs. {totalAmount.toLocaleString()}.00</Text>
        </View>
        <View style={styles.placeholderWidth} />
      </View>

      {/* Selector Tabs matching Image 5 subheader */}
      <View style={styles.selectorTabsRow}>
        <TouchableOpacity
          style={[styles.selectorTab, activeMethod === "cash" && styles.selectorTabActive]}
          onPress={() => { hapticFeedback.selection(); setActiveMethod("cash"); setTenderedVal(""); }}
        >
          <Feather name="pocket" size={14} color={activeMethod === "cash" ? TOKENS.primary : TOKENS.muted} />
          <Text style={[styles.selectorTabText, activeMethod === "cash" && styles.selectorTabTextActive]}>
            Cash
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.selectorTab, activeMethod === "card" && styles.selectorTabActive]}
          onPress={() => { hapticFeedback.selection(); setActiveMethod("card"); setTenderedVal(totalAmount.toString()); }}
        >
          <Feather name="credit-card" size={14} color={activeMethod === "card" ? TOKENS.primary : TOKENS.muted} />
          <Text style={[styles.selectorTabText, activeMethod === "card" && styles.selectorTabTextActive]}>
            Card
          </Text>
        </TouchableOpacity>
      </View>

      {/* Input Tender area & Change block exactly like Image 5 */}
      <View style={styles.tenderDetailsCard}>
        {activeMethod === "cash" && (
          <>
            <Text style={styles.tenderLabel}>Cash Tendered</Text>
            <Text style={styles.tenderValueText}>
              Rs. {parsedTendered > 0 ? parsedTendered.toLocaleString() : "0"}
            </Text>

            {parsedTendered > totalAmount && (
              <View style={styles.changeBubble}>
                <Text style={styles.changeBubbleText}>
                  Change : Rs. {changeDue.toLocaleString()}
                </Text>
              </View>
            )}
          </>
        )}

        {activeMethod === "card" && (
          <View style={styles.cardPaymentContainer}>
            {/* Visual Simulated Credit Card */}
            <View style={styles.simCard}>
              <View style={styles.simCardHeader}>
                <Feather name="wifi" size={18} color={TOKENS.card} />
              </View>
              
              <Text style={styles.simCardNumber}>
                ••••  ••••  ••••  {lastFourDigits || "••••"}
              </Text>
              
              <View style={styles.simCardFooter}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.simCardHolderLabel}>BANK / CARDHOLDER</Text>
                  <Text numberOfLines={1} style={styles.simCardHolderName}>
                    {selectedBank || "Shopbook Customer"}
                  </Text>
                </View>
                <View style={styles.simCardBrandBadge}>
                  <View style={[styles.simCardBrandCircle, {backgroundColor: TOKENS.warning, marginRight: -8}]} />
                  <View style={[styles.simCardBrandCircle, {backgroundColor: TOKENS.error}]} />
                </View>
              </View>
            </View>

            {/* Bank Selection and Last 4 Digits input */}
            <View style={styles.cardForm}>
              {/* Bank Selection Dropdown */}
              <TouchableOpacity
                style={styles.dropdownButton}
                activeOpacity={0.7}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowBankSheet(true);
                }}
              >
                <View style={styles.dropdownContent}>
                  <Text style={styles.inputLabel}>Bank Name</Text>
                  <Text style={[styles.dropdownValue, !selectedBank && styles.dropdownPlaceholder]}>
                    {selectedBank || "Select Sri Lankan Bank"}
                  </Text>
                </View>
                <Feather name="chevron-down" size={20} color={TOKENS.muted} />
              </TouchableOpacity>

              {/* Card Last 4 Digits Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Last 4 Digits</Text>
                <TextInput
                  style={styles.textInput}
                  value={lastFourDigits}
                  onChangeText={(val) => {
                    const numericVal = val.replace(/[^0-9]/g, "");
                    setLastFourDigits(numericVal.slice(0, 4));
                  }}
                  placeholder="e.g. 1234"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
            </View>

            <View style={styles.cardStatusBox}>
              <Feather name="loader" size={18} color={TOKENS.primary} />
              <Text style={styles.cardAreaTitle}>Swipe, Tap, or Insert Card</Text>
              <Text style={styles.cardAreaSubtitle}>
                Connected POS terminal is ready for payment of Rs. {totalAmount.toLocaleString()}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Control buttons & Numpad only visible for Cash payments */}
      {activeMethod === "cash" && (
        <View style={styles.keyboardControlsContainer}>
          {/* Row of quick add cash modifiers */}
          <View style={styles.quickAddRow}>
            <TouchableOpacity style={styles.quickCashBtn} onPress={() => handleAddQuickCash(500)}>
              <Text style={styles.quickCashText}>+ 500</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCashBtn} onPress={() => handleAddQuickCash(1000)}>
              <Text style={styles.quickCashText}>+ 1,000</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCashBtn} onPress={() => handleAddQuickCash(2000)}>
              <Text style={styles.quickCashText}>+ 2,000</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCashBtn} onPress={() => handleAddQuickCash(5000)}>
              <Text style={styles.quickCashText}>+ 5,000</Text>
            </TouchableOpacity>
          </View>

          {/* Exact Match button */}
          <TouchableOpacity
            style={styles.exactMatchContainer}
            activeOpacity={0.8}
            onPress={handleExactMatch}
          >
            <Text style={styles.exactMatchText}>Exact · Rs. {totalAmount.toLocaleString()}</Text>
          </TouchableOpacity>

          {/* Large Custom Numeric Numpad */}
          <View style={styles.numpadGrid}>
            <View style={styles.numpadRow}>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("1")}>
                <Text style={styles.numKeyText}>1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("2")}>
                <Text style={styles.numKeyText}>2</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("3")}>
                <Text style={styles.numKeyText}>3</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.numpadRow}>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("4")}>
                <Text style={styles.numKeyText}>4</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("5")}>
                <Text style={styles.numKeyText}>5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("6")}>
                <Text style={styles.numKeyText}>6</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.numpadRow}>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("7")}>
                <Text style={styles.numKeyText}>7</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("8")}>
                <Text style={styles.numKeyText}>8</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("9")}>
                <Text style={styles.numKeyText}>9</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.numpadRow}>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("00")}>
                <Text style={styles.numKeyText}>00</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("0")}>
                <Text style={styles.numKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.numKey} onPress={() => handleNumPress("backspace")}>
                <Ionicons name="backspace-outline" size={22} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Massive checkout action complete button */}
      <TouchableOpacity
        style={[
          styles.actionCompleteBtn,
          { marginBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 12) : 16 },
        ]}
        activeOpacity={0.85}
        onPress={handleCompleteSale}
      >
        <Text style={styles.completeBtnText}>Complete Sale & Print Receipt</Text>
        <Feather name="printer" size={18} color={TOKENS.card} />
      </TouchableOpacity>

      {/* GORGEOUS PAYMENT SUCCESS MODAL DIALOG */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleFinishSuccess}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.successIconWrapper}>
              <Feather name="check" size={32} color={TOKENS.card} />
            </View>

            <Text style={styles.modalTitle}>Payment Successful!</Text>
            <Text style={styles.modalInvoice}>Invoice ##2041 Approved</Text>

            <View style={styles.modalDetailsRow}>
              <View style={styles.modalDetailCol}>
                <Text style={styles.modalDetailLabel}>Method</Text>
                <Text style={styles.modalDetailVal}>{activeMethod.toUpperCase()}</Text>
              </View>

              <View style={styles.modalDetailCol}>
                <Text style={styles.modalDetailLabel}>Total Paid</Text>
                <Text style={styles.modalDetailVal}>Rs. {totalAmount.toLocaleString()}</Text>
              </View>

              {activeMethod === "cash" && (
                <View style={styles.modalDetailCol}>
                  <Text style={styles.modalDetailLabel}>Change</Text>
                  <Text style={styles.modalDetailVal}>Rs. {changeDue.toLocaleString()}</Text>
                </View>
              )}
            </View>

            <Text style={styles.printMessage}>
              {pairedPrinter 
                ? `Connected printer: ${pairedPrinter} 🖨️` 
                : "No printer connected. Enable in Settings."}
            </Text>

            <View style={styles.modalActionsContainer}>
              <TouchableOpacity
                style={styles.printBtn}
                activeOpacity={0.8}
                onPress={handlePrintReceipt}
              >
                <Feather name="printer" size={16} color={TOKENS.card} />
                <Text style={styles.printBtnText}>Print Invoice</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneBtn}
                activeOpacity={0.85}
                onPress={handleFinishSuccess}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sri Lankan Banks BottomSheet Selection */}
      <BottomSheet
        visible={showBankSheet}
        onClose={() => setShowBankSheet(false)}
        title="Select Sri Lankan Bank"
      >
        <ScrollView style={styles.bankListScrollView} keyboardShouldPersistTaps="handled">
          {SRI_LANKAN_BANKS.map((bank) => (
            <TouchableOpacity
              key={bank}
              style={[
                styles.bankItem,
                selectedBank === bank && styles.bankItemActive,
              ]}
              onPress={() => {
                setSelectedBank(bank);
                setShowBankSheet(false);
              }}
            >
              <Text style={[
                styles.bankItemText,
                selectedBank === bank && styles.bankItemTextActive,
              ]}>
                {bank}
              </Text>
              {selectedBank === bank && (
                <Feather name="check" size={16} color={TOKENS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
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
  headerTitleWrapper: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 2,
  },
  placeholderWidth: {
    width: 36,
  },
  selectorTabsRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  selectorTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    borderRadius: 8,
    gap: 6,
  },
  selectorTabActive: {
    backgroundColor: TOKENS.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  selectorTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.muted,
  },
  selectorTabTextActive: {
    color: TOKENS.primary,
    fontWeight: "bold",
  },
  tenderDetailsCard: {
    flex: 1,
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tenderLabel: {
    fontSize: 14,
    color: TOKENS.muted,
    fontWeight: "600",
  },
  tenderValueText: {
    fontSize: 38,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginTop: 10,
  },
  changeBubble: {
    backgroundColor: "#E6F4EA",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 14,
  },
  changeBubbleText: {
    color: "#137333",
    fontWeight: "700",
    fontSize: 14,
  },
  cardPaymentContainer: {
    width: "100%",
    alignItems: "center",
    gap: 20,
  },
  simCard: {
    backgroundColor: "#0F172A",
    width: "90%",
    aspectRatio: 1.586,
    borderRadius: 16,
    padding: 20,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  simCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  simCardNumber: {
    color: TOKENS.card,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "center",
    marginVertical: 14,
  },
  simCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  simCardHolderLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  simCardHolderName: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 2,
  },
  simCardBrandBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  simCardBrandCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    opacity: 0.85,
  },
  cardStatusBox: {
    alignItems: "center",
    gap: 8,
  },
  cardAreaTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
    textAlign: "center",
  },
  cardAreaSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  keyboardControlsContainer: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  quickAddRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickCashBtn: {
    flex: 1,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickCashText: {
    color: TOKENS.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  exactMatchContainer: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: TOKENS.primary,
    borderRadius: 8,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F4FF",
  },
  exactMatchText: {
    color: TOKENS.primary,
    fontWeight: "bold",
    fontSize: 14,
  },
  numpadGrid: {
    gap: 8,
    marginTop: 4,
  },
  numpadRow: {
    flexDirection: "row",
    gap: 8,
  },
  numKey: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  numKeyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  actionCompleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.primary,
    marginHorizontal: 16,
    height: 48,
    borderRadius: 24,
    gap: 10,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  completeBtnText: {
    color: TOKENS.card,
    fontSize: 15,
    fontWeight: "bold",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: TOKENS.card,
    width: "100%",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  successIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TOKENS.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: TOKENS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  modalInvoice: {
    fontSize: 13,
    color: TOKENS.muted,
    marginTop: 4,
  },
  modalDetailsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: 20,
    backgroundColor: "#F9FAFB",
  },
  modalDetailCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  modalDetailLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: "600",
  },
  modalDetailVal: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  printMessage: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 16,
  },
  modalActionsContainer: {
    width: "100%",
    gap: 12,
    marginTop: 16,
  },
  printBtn: {
    backgroundColor: TOKENS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 44,
    borderRadius: 22,
  },
  printBtnText: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 15,
  },
  doneBtn: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: TOKENS.border,
    width: "100%",
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: {
    color: TOKENS.dark,
    fontWeight: "bold",
    fontSize: 15,
  },
  cardForm: {
    width: "90%",
    gap: 12,
    marginTop: 8,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
  },
  dropdownContent: {
    gap: 2,
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  dropdownPlaceholder: {
    color: "#94A3B8",
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
  },
  textInput: {
    fontSize: 14,
    fontWeight: "600",
    color: TOKENS.dark,
    padding: 0,
    marginTop: 2,
  },
  bankListScrollView: {
    maxHeight: 350,
  },
  bankItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    paddingHorizontal: 8,
  },
  bankItemActive: {
    backgroundColor: "#F0F4FF",
    borderRadius: 8,
  },
  bankItemText: {
    fontSize: 14,
    color: TOKENS.dark,
  },
  bankItemTextActive: {
    color: TOKENS.primary,
    fontWeight: "bold",
  },
});
