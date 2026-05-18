import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { cartState } from "../data/cartState";

type TenderMethod = "cash" | "card" | "credit";

export const PaymentTenderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const totalAmount = parseFloat(params.totalAmount as string) || 2905;
  const initialMethod = (params.paymentMethod as TenderMethod) || "cash";

  const [activeMethod, setActiveMethod] = useState<TenderMethod>(initialMethod);
  const [tenderedVal, setTenderedVal] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Dynamic values
  const parsedTendered = useMemo(() => {
    return parseFloat(tenderedVal) || 0;
  }, [tenderedVal]);

  const changeDue = useMemo(() => {
    if (parsedTendered <= totalAmount) return 0;
    return parsedTendered - totalAmount;
  }, [parsedTendered, totalAmount]);

  const handleNumPress = (val: string) => {
    if (val === "backspace") {
      setTenderedVal((prev) => prev.slice(0, -1));
    } else {
      if (tenderedVal.length < 7) {
        setTenderedVal((prev) => prev + val);
      }
    }
  };

  const handleAddQuickCash = (amount: number) => {
    setTenderedVal((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + amount).toString();
    });
  };

  const handleExactMatch = () => {
    setTenderedVal(totalAmount.toString());
  };

  const handleCompleteSale = () => {
    if (activeMethod === "cash" && parsedTendered < totalAmount) {
      Alert.alert("Insufficient Tender", `Amount tendered must be at least Rs. ${totalAmount.toLocaleString()}`);
      return;
    }
    setShowSuccessModal(true);
  };

  const handleFinishSuccess = () => {
    setShowSuccessModal(false);
    cartState.clearCart(); // clear invoice cart
    router.push("/pos");  // redirect back to POS home page
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      
      {/* Header exactly matching Image 5 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/payment")}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>
            {activeMethod === "cash" ? "Cash" : activeMethod === "card" ? "Card Payment" : "On Credit"}
          </Text>
          <Text style={styles.headerSubtitle}>Total · Rs. {totalAmount.toLocaleString()}.00</Text>
        </View>
        <View style={styles.placeholderWidth} />
      </View>

      {/* Selector Tabs matching Image 5 subheader */}
      <View style={styles.selectorTabsRow}>
        <TouchableOpacity
          style={[styles.selectorTab, activeMethod === "cash" && styles.selectorTabActive]}
          onPress={() => { setActiveMethod("cash"); setTenderedVal(""); }}
        >
          <Feather name="pocket" size={14} color={activeMethod === "cash" ? TOKENS.primary : TOKENS.muted} />
          <Text style={[styles.selectorTabText, activeMethod === "cash" && styles.selectorTabTextActive]}>
            Cash
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.selectorTab, activeMethod === "card" && styles.selectorTabActive]}
          onPress={() => { setActiveMethod("card"); setTenderedVal(totalAmount.toString()); }}
        >
          <Feather name="credit-card" size={14} color={activeMethod === "card" ? TOKENS.primary : TOKENS.muted} />
          <Text style={[styles.selectorTabText, activeMethod === "card" && styles.selectorTabTextActive]}>
            Card
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.selectorTab, activeMethod === "credit" && styles.selectorTabActive]}
          onPress={() => { setActiveMethod("credit"); setTenderedVal(""); }}
        >
          <Feather name="book-open" size={14} color={activeMethod === "credit" ? TOKENS.primary : TOKENS.muted} />
          <Text style={[styles.selectorTabText, activeMethod === "credit" && styles.selectorTabTextActive]}>
            On Credit
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
          <View style={styles.cardPaymentMethodArea}>
            <Ionicons name="card" size={44} color={TOKENS.primary} />
            <Text style={styles.cardAreaTitle}>Ready to swipe or insert card</Text>
            <Text style={styles.cardAreaSubtitle}>Swipe or tap client card on connected card reader reader terminal.</Text>
          </View>
        )}

        {activeMethod === "credit" && (
          <View style={styles.creditPaymentMethodArea}>
            <Ionicons name="people-circle" size={44} color="#B06000" />
            <Text style={styles.cardAreaTitle}>Attach Customer Book Account</Text>
            <Text style={styles.cardAreaSubtitle}>The total outstanding amount of Rs. {totalAmount.toLocaleString()} will be debited to active book account.</Text>
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
        <Text style={styles.completeBtnText}>Complete Sale & Print Receipt 🖨️</Text>
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

            <Text style={styles.printMessage}>Receipt printed successfully. Cash drawer unlocked.</Text>

            <TouchableOpacity
              style={styles.doneBtn}
              activeOpacity={0.85}
              onPress={handleFinishSuccess}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  cardPaymentMethodArea: {
    alignItems: "center",
    gap: 12,
  },
  creditPaymentMethodArea: {
    alignItems: "center",
    gap: 12,
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
    backgroundColor: TOKENS.primary,
    marginHorizontal: 16,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
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
  doneBtn: {
    backgroundColor: TOKENS.primary,
    width: "100%",
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  doneBtnText: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 15,
  },
});
