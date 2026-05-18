import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";

type PaymentMethodType = "cash" | "card" | "credit";

export const PaymentScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Parse params passed from Checkout cart
  const totalAmount = parseFloat(params.totalAmount as string) || 2905;
  const subtotal = parseFloat(params.subtotal as string) || 2790;
  const discount = parseFloat(params.discount as string) || 100;
  const tax = parseFloat(params.tax as string) || 215;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>("cash");

  const handleSelectMethod = (method: PaymentMethodType) => {
    setSelectedMethod(method);
  };

  const handleContinue = () => {
    // Navigate to tender numpad, passing payment type and total
    router.push({
      pathname: "/payment-tender",
      params: {
        paymentMethod: selectedMethod,
        totalAmount: totalAmount.toString(),
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      {/* Header exactly matching Image 4 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/cart")}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Choose Payment Method</Text>
          <Text style={styles.headerSubtitle}>Total Rs. {totalAmount.toLocaleString()}.00</Text>
        </View>
        <View style={styles.placeholderWidth} />
      </View>

      {/* Payment methods list container */}
      <View style={styles.content}>
        {/* Cash Tile */}
        <TouchableOpacity
          style={[
            styles.paymentTile,
            selectedMethod === "cash" && styles.paymentTileActive,
          ]}
          activeOpacity={0.8}
          onPress={() => handleSelectMethod("cash")}
        >
          <View style={[styles.iconWrapper, { backgroundColor: "#E6F4EA" }]}>
            <Feather name="pocket" size={20} color="#137333" />
          </View>

          <View style={styles.tileTextWrapper}>
            <Text style={styles.tileTitle}>Cash</Text>
            <Text style={styles.tileSubtitle}>Quick & easy</Text>
          </View>

          <View style={styles.radioWrapper}>
            {selectedMethod === "cash" ? (
              <View style={styles.radioOuterSelected}>
                <View style={styles.radioInnerSelected} />
              </View>
            ) : (
              <View style={styles.radioUnselected} />
            )}
          </View>
        </TouchableOpacity>

        {/* Card Tile */}
        <TouchableOpacity
          style={[
            styles.paymentTile,
            selectedMethod === "card" && styles.paymentTileActive,
          ]}
          activeOpacity={0.8}
          onPress={() => handleSelectMethod("card")}
        >
          <View style={[styles.iconWrapper, { backgroundColor: "#E8F0FE" }]}>
            <Feather name="credit-card" size={20} color={TOKENS.primary} />
          </View>

          <View style={styles.tileTextWrapper}>
            <Text style={styles.tileTitle}>Card</Text>
            <Text style={styles.tileSubtitle}>Tap or insert</Text>
          </View>

          <View style={styles.radioWrapper}>
            {selectedMethod === "card" ? (
              <View style={styles.radioOuterSelected}>
                <View style={styles.radioInnerSelected} />
              </View>
            ) : (
              <View style={styles.radioUnselected} />
            )}
          </View>
        </TouchableOpacity>

        {/* On Credit Tile */}
        <TouchableOpacity
          style={[
            styles.paymentTile,
            selectedMethod === "credit" && styles.paymentTileActive,
          ]}
          activeOpacity={0.8}
          onPress={() => handleSelectMethod("credit")}
        >
          <View style={[styles.iconWrapper, { backgroundColor: "#FEF7E0" }]}>
            <Feather name="book-open" size={20} color="#B06000" />
          </View>

          <View style={styles.tileTextWrapper}>
            <Text style={styles.tileTitle}>On Credit</Text>
            <Text style={styles.tileSubtitle}>Add to customer book</Text>
          </View>

          <View style={styles.radioWrapper}>
            {selectedMethod === "credit" ? (
              <View style={styles.radioOuterSelected}>
                <View style={styles.radioInnerSelected} />
              </View>
            ) : (
              <View style={styles.radioUnselected} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Summary Box exactly matching Image 4 at bottom */}
      <View style={styles.bottomSection}>
        <View style={styles.summaryCard}>
          <View style={styles.summarySubrow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>Rs. {subtotal.toLocaleString()}.00</Text>
          </View>

          <View style={styles.summarySubrow}>
            <Text style={styles.discountLabel}>Discount</Text>
            <Text style={styles.discountValue}>-Rs. {discount.toLocaleString()}.00</Text>
          </View>

          <View style={styles.summarySubrow}>
            <Text style={styles.summaryLabel}>Tax (8%)</Text>
            <Text style={styles.summaryValue}>Rs. {tax.toLocaleString()}.00</Text>
          </View>

          <View style={styles.dividerLine} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs. {totalAmount.toLocaleString()}.00</Text>
          </View>
        </View>

        {/* Next checkout button */}
        <TouchableOpacity
          style={styles.continueButton}
          activeOpacity={0.85}
          onPress={handleContinue}
        >
          <Text style={styles.continueText}>Continue with Payment</Text>
          <Feather name="arrow-right" size={16} color={TOKENS.card} />
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  paymentTile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  paymentTileActive: {
    borderColor: TOKENS.primary,
    shadowColor: TOKENS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  tileTextWrapper: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  tileSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 4,
  },
  radioWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  radioUnselected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#BDC3C7",
  },
  radioOuterSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInnerSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TOKENS.primary,
  },
  bottomSection: {
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },
  summaryCard: {
    gap: 8,
  },
  summarySubrow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    color: TOKENS.muted,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  discountLabel: {
    fontSize: 13,
    color: TOKENS.muted,
  },
  discountValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.error,
  },
  dividerLine: {
    height: 1,
    backgroundColor: TOKENS.border,
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.primary,
    height: 48,
    borderRadius: 24,
    gap: 8,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  continueText: {
    color: TOKENS.card,
    fontSize: 14,
    fontWeight: "bold",
  },
});
