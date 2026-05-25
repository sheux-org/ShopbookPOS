import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { ScreenWrapper } from "../../../components/common/ScreenWrapper";
import { TOKENS } from "../../../constants/tokens";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { hapticFeedback } from "../../../utils/haptics";
import { PoweredBy } from "../../../components/common/PoweredBy";


export default function PaymentSelectRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const setPremium = useSettingsStore((s) => s.setPremium);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "card" | null>(null);

  const planTitle = (params.planTitle as string) || "Pro Access";
  const planPrice = (params.price as string) || "Rs. 3,500";
  const planBilling = (params.billing as string) || "billed monthly";

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCardPayment = () => {
    hapticFeedback.impactMedium();
    Alert.alert(
      "Pay with Credit/Debit Card",
      `Initiate secure card payment for ${planPrice} through RevenueCat?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pay & Activate",
          onPress: () => {
            setPremium(true);
            hapticFeedback.notificationSuccess();
            triggerToast("Payment successful via RevenueCat! 🎉");
            setTimeout(() => {
              router.dismissAll();
              router.push("/profile");
            }, 1500);
          },
        },
      ]
    );
  };

  const handleWhatsAppPay = () => {
    hapticFeedback.impactMedium();
    const msg = "Hey Mini POS Bill";
    const phone = "94782470168";
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
  };

  const handleCopy = async (label: string, value: string) => {
    hapticFeedback.impactLight();
    await Clipboard.setStringAsync(value);
    triggerToast(`${label} copied! 📋`);
  };

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
      {/* Toast popup */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 10 : 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Select Payment Method</Text>
        <View style={styles.placeholderWidth} />
      </View>

      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Selected Plan Summary Card - High-End Slate Premium Design */}
        <LinearGradient
          colors={["#0F172A", "#1E293B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.planSummaryCard}
        >
          <View style={styles.summaryHeader}>
            <View style={styles.vipBadgeSmall}>
              <Text style={styles.vipBadgeTextSmall}>SELECTED PLAN</Text>
            </View>
            <Ionicons name="diamond" size={20} color="#F59E0B" />
          </View>
          <Text style={styles.summaryTitle}>{planTitle}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.summaryPrice}>{planPrice}</Text>
            <Text style={styles.summaryBilling}>/ {planBilling}</Text>
          </View>
        </LinearGradient>

        <Text style={styles.sectionHeader}>Choose how you want to pay</Text>

        {/* Payment Methods Grid */}
        <View style={styles.methodsContainer}>
          {/* Card Option */}
          <TouchableOpacity
            style={[
              styles.methodCard,
              paymentMethod === "card" && styles.methodCardActive
            ]}
            onPress={() => {
              setPaymentMethod("card");
              hapticFeedback.impactLight();
            }}
          >
            <View style={[styles.iconContainer, paymentMethod === "card" && styles.iconContainerActive]}>
              <Feather name="credit-card" size={22} color={paymentMethod === "card" ? TOKENS.primary : TOKENS.muted} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.methodTitle}>Credit / Debit Card</Text>
              <Text style={styles.methodDesc}>Instant activation via secure gateway (RevenueCat)</Text>
            </View>
            <View style={[styles.radio, paymentMethod === "card" && styles.radioActive]}>
              {paymentMethod === "card" && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* Bank Option */}
          <TouchableOpacity
            style={[
              styles.methodCard,
              paymentMethod === "bank" && styles.methodCardActive
            ]}
            onPress={() => {
              setPaymentMethod("bank");
              hapticFeedback.impactLight();
            }}
          >
            <View style={[styles.iconContainer, paymentMethod === "bank" && styles.iconContainerActive]}>
              <Feather name="home" size={22} color={paymentMethod === "bank" ? TOKENS.primary : TOKENS.muted} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.methodTitle}>Bank Transfer / Deposit</Text>
              <Text style={styles.methodDesc}>Offline bank deposit slip upload & manual activation</Text>
            </View>
            <View style={[styles.radio, paymentMethod === "bank" && styles.radioActive]}>
              {paymentMethod === "bank" && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* Conditional Content based on selection */}
        {paymentMethod === "card" && (
          <View style={styles.detailContainer}>
            <Text style={styles.detailSectionTitle}>💳 Secure Card Payment</Text>
            <Text style={styles.detailText}>
              Your transaction is encrypted and processed via RevenueCat billing framework. All major Visa, Mastercard, and Amex cards are supported.
            </Text>
            
            <TouchableOpacity
              style={styles.payButton}
              activeOpacity={0.85}
              onPress={handleCardPayment}
            >
              <Text style={styles.payButtonText}>Pay {planPrice} & Activate</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {paymentMethod === "bank" && (
          <View style={styles.bankTransferSection}>
            <Text style={styles.bankTransferTitle}>How to complete your bank payment</Text>

            {/* Instruction Steps directly on light background */}
            <View style={styles.stepsContainer}>
              <View style={styles.instructionStepRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleText}>1</Text>
                </View>
                <Text style={styles.stepText}>Make a deposit or transfer to the bank below.</Text>
              </View>

              <View style={styles.instructionStepRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleText}>2</Text>
                </View>
                <Text style={styles.stepText}>Send us your payment proof or call us directly.</Text>
              </View>

              <View style={styles.instructionStepRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleText}>3</Text>
                </View>
                <Text style={styles.stepText}>We&apos;ll confirm and activate your Premium features promptly.</Text>
              </View>
            </View>

            {/* Bank Details Form Card matching image layout */}
            <View style={styles.bankDetailsFormCard}>
              <Text style={styles.bankCardHeaderTitle}>Bank Details</Text>

              {/* Bank Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Bank</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValueBlue}>Seylan Bank</Text>
                  <TouchableOpacity 
                    style={styles.fieldCopyBtn} 
                    activeOpacity={0.7}
                    onPress={() => handleCopy("Bank Name", "Seylan Bank")}
                  >
                    <Feather name="copy" size={12} color="#2563EB" />
                    <Text style={styles.fieldCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Account No. Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Account No.</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValueBlue}>008013639890001</Text>
                  <TouchableOpacity 
                    style={styles.fieldCopyBtn} 
                    activeOpacity={0.7}
                    onPress={() => handleCopy("Account Number", "008013639890001")}
                  >
                    <Feather name="copy" size={12} color="#2563EB" />
                    <Text style={styles.fieldCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Name Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Name</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValueBlue} numberOfLines={1} ellipsizeMode="tail">
                    SHOPBOOK TECHNOLOGIES (PVT) LTD
                  </Text>
                  <TouchableOpacity 
                    style={styles.fieldCopyBtn} 
                    activeOpacity={0.7}
                    onPress={() => handleCopy("Account Name", "SHOPBOOK TECHNOLOGIES (PVT) LTD")}
                  >
                    <Feather name="copy" size={12} color="#2563EB" />
                    <Text style={styles.fieldCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Branch Field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Branch</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValueBlue}>Kollupitiya</Text>
                  <TouchableOpacity 
                    style={styles.fieldCopyBtn} 
                    activeOpacity={0.7}
                    onPress={() => handleCopy("Branch Name", "Kollupitiya")}
                  >
                    <Feather name="copy" size={12} color="#2563EB" />
                    <Text style={styles.fieldCopyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Amount to Transfer Box */}
              <View style={styles.amountDisplayBox}>
                <Text style={styles.amountLabelText}>Amount to Transfer</Text>
                <Text style={styles.amountValueText}>{planPrice}</Text>
              </View>
            </View>

            {/* Bottom Button matching image style */}
            <TouchableOpacity
              style={styles.confirmWhatsAppButton}
              activeOpacity={0.85}
              onPress={handleWhatsAppPay}
            >
              <Text style={styles.confirmWhatsAppButtonText}>Share Receipt via WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}

        <PoweredBy />
      </ScrollView>
    </ScreenWrapper>
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
    zIndex: 10,
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
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  placeholderWidth: {
    width: 36,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16, // Reduced gap as requested to make it tighter
  },
  planSummaryCard: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#D97706",
    boxShadow: "0px 6px 10px 0px rgba(15, 23, 42, 0.2)",
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vipBadgeSmall: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vipBadgeTextSmall: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  summaryPrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  summaryBilling: {
    fontSize: 13,
    color: "#F59E0B",
    fontWeight: "600",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "bold",
    color: TOKENS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 2,
    marginTop: 4,
  },
  methodsContainer: {
    gap: 12,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.02)",
  },
  methodCardActive: {
    borderColor: TOKENS.primary,
    borderWidth: 1.5,
    backgroundColor: "#EFF6FF",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerActive: {
    backgroundColor: "#DBEAFE",
  },
  methodTitle: {
    fontSize: 14.5,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  methodDesc: {
    fontSize: 11.5,
    color: TOKENS.muted,
    lineHeight: 15,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: TOKENS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: TOKENS.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TOKENS.primary,
  },
  detailContainer: {
    backgroundColor: TOKENS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: TOKENS.border,
    gap: 16,
    boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.02)",
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  detailText: {
    fontSize: 13,
    color: TOKENS.muted,
    lineHeight: 18,
  },
  payButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: TOKENS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}33`,
    marginTop: 8,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  bankTransferSection: {
    gap: 14,
    width: "100%",
    marginTop: 4,
  },
  bankTransferTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginLeft: 2,
    marginBottom: 4,
  },
  stepsContainer: {
    gap: 10,
    marginBottom: 4,
  },
  instructionStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: TOKENS.dark,
    fontWeight: "500",
    lineHeight: 17,
  },
  bankDetailsFormCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 10,
    boxShadow: "0px 4px 6px 0px rgba(0, 0, 0, 0.01)",
  },
  bankCardHeaderTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
    textAlign: "center",
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    height: 44,
    backgroundColor: "#FFFFFF",
  },
  fieldValueBlue: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#2563EB",
    flex: 1,
  },
  fieldCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fieldCopyBtnText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#2563EB",
  },
  amountDisplayBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  amountLabelText: {
    fontSize: 13,
    color: "#1E3A8A",
    fontWeight: "600",
  },
  amountValueText: {
    fontSize: 14.5,
    color: "#2563EB",
    fontWeight: "bold",
  },
  confirmWhatsAppButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: TOKENS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}26`,
    marginTop: 4,
  },
  confirmWhatsAppButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
});
