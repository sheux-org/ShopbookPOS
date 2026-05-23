import { Feather } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cartState } from "../../../components/data/cartState";
import { TOKENS } from "../../../constants/tokens";
import { useVerifyOtp, useRegisterUser } from "../../../hooks/useAuth";

const CATEGORIES = [
  { label: "Grocery", icon: "🛒" },
  { label: "Dairy", icon: "🥛" },
  { label: "Drinks", icon: "🥤" },
  { label: "Snacks", icon: "🍪" },
  { label: "Household", icon: "🏠" },
  { label: "Other", icon: "✨" },
];

export default function NumberInputRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(cartState.getIsLoggedIn());
  const [step, setStep] = useState<"phone" | "otp" | "register">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [tempToken, setTempToken] = useState("");

  // Onboarding registration state fields
  const [businessName, setBusinessName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Focus and keyboard refs
  const nameInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const verifyOtpMutation = useVerifyOtp();
  const registerUserMutation = useRegisterUser();

  useEffect(() => {
    const syncState = () => {
      setIsLoggedIn(cartState.getIsLoggedIn());
    };
    return cartState.subscribe(syncState);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const normalizePhone = (phoneStr: string): string => {
    let cleaned = phoneStr.replace(/\D/g, "");
    if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    return cleaned;
  };

  const handleSendOtp = async () => {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 9) {
      triggerToast("Please enter a valid mobile number!");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("https://mini-pos-sync-server.vercel.app/api/v1/auth/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone_number: cleanPhone }),
      });

      if (!response.ok) {
        throw new Error("Failed to check phone number. Please try again.");
      }

      const resData = await response.json();
      const { token, hasAccount: remoteHasAccount } = resData;

      if (!token) {
        throw new Error("Server error: Authorization token is missing.");
      }

      setTempToken(token);
      setHasAccount(remoteHasAccount);
      setStep("otp");
      setOtp("");
      triggerToast("Verification code sent to +94 " + phone);
    } catch (err: any) {
      triggerToast(err.message || "Network error. Please check your connection.");
      console.error("Auth check API failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = (currentOtp?: string) => {
    const codeToVerify = currentOtp || otp;
    if (codeToVerify.length < 4) {
      triggerToast("Please enter a 4-digit code!");
      return;
    }
    setIsLoading(true);
    setOtpError(false);

    verifyOtpMutation.mutate({
      phone,
      otp: codeToVerify,
      token: tempToken,
      hasAccount,
    }, {
      onSuccess: (data) => {
        setIsLoading(false);
        if (data.status === "success") {
          setOtpError(false);
          triggerToast("Welcome back to Mini POS!");
          router.replace("/(tabs)");
        } else {
          triggerToast("Number not registered. Let's create your shop profile!");
          setStep("register");
        }
      },
      onError: (err: any) => {
        setIsLoading(false);
        setOtpError(true);
        triggerToast(err.message || "Invalid OTP code. Please try again.");
        setOtp("");
      }
    });
  };

  const handleRegister = () => {
    if (!businessName.trim()) {
      triggerToast("Please enter your Shop/Business Name!");
      return;
    }
    if (!newCategory.trim()) {
      triggerToast("Please enter business type/category!");
      return;
    }
    if (!businessAddress.trim()) {
      triggerToast("Please enter your Store Address!");
      return;
    }

    setIsLoading(true);
    registerUserMutation.mutate({
      phone,
      businessName: businessName.trim(),
      category: newCategory.trim(),
      address: businessAddress.trim(),
    }, {
      onSuccess: () => {
        setIsLoading(false);
        triggerToast("Account registered and logged in successfully! 🎉");
        router.replace("/(tabs)");
      },
      onError: (err: any) => {
        console.error("Failed to register business in SQLite:", err);
        setIsLoading(false);
        triggerToast("Failed to create profile. Please try again.");
      }
    });
  };

  // If already logged in, redirect automatically to tabs!
  if (isLoggedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Toast popup */}
        {toastMessage && (
          <View style={styles.toastContainer}>
            <Feather name="info" size={16} color={TOKENS.card} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* Branding header */}
        <View style={styles.brandingWrapper}>
          <View style={styles.logoSquare}>
            <Feather name="book-open" size={32} color={TOKENS.card} />
          </View>
          <Text style={styles.appName}>Mini POS</Text>
          <Text style={styles.appTagline}>Sleek & Modular Retail Terminal</Text>
        </View>

        {/* Dynamic Step Panels */}
        {step === "phone" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Device Authorization</Text>
            <Text style={styles.cardSubtitle}>
              Please enter your mobile number to securely sign in to your store.
            </Text>

            <Text style={styles.inputLabel}>Mobile Number</Text>

            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>🇱🇰 +94</Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="71 713 3074"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={12}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, phone.replace(/\s+/g, "").length < 9 && styles.submitButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleSendOtp}
              disabled={phone.replace(/\s+/g, "").length < 9 || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={TOKENS.card} size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Request OTP Code</Text>
                  <Feather name="arrow-right" size={16} color={TOKENS.card} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === "otp" && (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setStep("phone")}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={16} color={TOKENS.primary} />
              <Text style={styles.backBtnText}>Change number</Text>
            </TouchableOpacity>

            <Text style={styles.cardTitle}>Enter Verification Code</Text>
            <Text style={styles.cardSubtitle}>
              We sent a 4-digit verification code to +94 {phone}. Enter it below to unlock.
            </Text>

            <Text style={styles.inputLabel}>4-Digit OTP Code</Text>

            <View style={styles.otpContainer}>
              {/* Hidden absolute invisible TextInput for native keyboard */}
              <TextInput
                style={styles.hiddenOtpInput}
                keyboardType="number-pad"
                maxLength={4}
                value={otp}
                onChangeText={(val) => {
                  setOtp(val);
                  if (otpError) setOtpError(false);
                  if (val.length === 4) {
                    handleVerifyOtp(val);
                  }
                }}
                autoFocus={true}
              />

              {/* 4 Premium individual digit slot boxes */}
              <View style={styles.otpSlotsRow}>
                {[0, 1, 2, 3].map((idx) => {
                  const char = otp[idx] || "";
                  const isFocused = otp.length === idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.otpSlotBox,
                        char !== "" && styles.otpSlotBoxFilled,
                        isFocused && styles.otpSlotBoxFocused,
                        otpError && styles.otpSlotBoxError,
                      ]}
                    >
                      <Text style={[styles.otpSlotText, otpError && styles.otpSlotTextError]}>
                        {char}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, otp.length < 4 && styles.submitButtonDisabled]}
              activeOpacity={0.8}
              onPress={() => handleVerifyOtp()}
              disabled={otp.length < 4 || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={TOKENS.card} size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Verify</Text>
                  <Feather name="check" size={16} color={TOKENS.card} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {step === "register" && (
          <View style={styles.card}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (registerStep === 1) {
                  setStep("otp");
                } else {
                  setRegisterStep((prev) => (prev - 1) as 1 | 2 | 3);
                }
              }}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={16} color={TOKENS.primary} />
              <Text style={styles.backBtnText}>
                {registerStep === 1 ? "Back to OTP" : "Previous step"}
              </Text>
            </TouchableOpacity>

            {/* Onboarding Progressive Header */}
            <View style={styles.onboardingHeader}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${(registerStep / 3) * 100}%` }]} />
              </View>
              <Text style={styles.stepIndicatorText}>{registerStep}/3</Text>
            </View>

            {/* Step 1: Business Name */}
            {registerStep === 1 && (
              <View>
                <Text style={styles.onboardingTitle}>Tell us your Business Name</Text>
                <Text style={styles.onboardingSubtitle}>This will be displayed on your invoices and profile.</Text>

                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.premiumInputWrapper, isInputFocused && styles.premiumInputWrapperFocused]}
                  onPress={() => nameInputRef.current?.focus()}
                >
                  <TextInput
                    ref={nameInputRef}
                    style={styles.premiumTextInput}
                    placeholder="e.g. Green Mart"
                    placeholderTextColor="#9CA3AF"
                    value={businessName}
                    onChangeText={setBusinessName}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                  />
                  {businessName.trim() !== "" && (
                    <Feather name="check" size={18} color={TOKENS.primary} style={styles.inputCheckmark} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.premiumNextBtn, !businessName.trim() && styles.premiumNextBtnDisabled]}
                  onPress={() => setRegisterStep(2)}
                  disabled={!businessName.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.premiumNextBtnText}>Next</Text>
                  <Feather name="arrow-right" size={16} color={TOKENS.card} />
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Business Type Grid */}
            {registerStep === 2 && (
              <View>
                <Text style={styles.onboardingTitle}>Tell us your Business Type</Text>
                <Text style={styles.onboardingSubtitle}>Select your primary retail store sector for tailored presets.</Text>

                <View style={styles.chipsContainer}>
                  {CATEGORIES.map((item) => {
                    const isSelected = newCategory === item.label;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[styles.chipBox, isSelected && styles.chipBoxSelected]}
                        onPress={() => setNewCategory(item.label)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.chipEmoji}>{item.icon}</Text>
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {item.label}
                        </Text>
                        {isSelected && (
                          <Feather name="check" size={12} color={TOKENS.primary} style={styles.chipCheck} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.premiumNextBtn, !newCategory && styles.premiumNextBtnDisabled]}
                  onPress={() => setRegisterStep(3)}
                  disabled={!newCategory}
                  activeOpacity={0.8}
                >
                  <Text style={styles.premiumNextBtnText}>Next</Text>
                  <Feather name="arrow-right" size={16} color={TOKENS.card} />
                </TouchableOpacity>
              </View>
            )}

            {/* Step 3: Address & Finish */}
            {registerStep === 3 && (
              <View>
                <Text style={styles.onboardingTitle}>Tell us your Store Address</Text>
                <Text style={styles.onboardingSubtitle}>Where is your main retail store outlet located?</Text>

                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.premiumInputWrapper, isInputFocused && styles.premiumInputWrapperFocused]}
                  onPress={() => addressInputRef.current?.focus()}
                >
                  <TextInput
                    ref={addressInputRef}
                    style={styles.premiumTextInput}
                    placeholder="e.g. 123 Galle Road, Colombo 03"
                    placeholderTextColor="#9CA3AF"
                    value={businessAddress}
                    onChangeText={setBusinessAddress}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                  />
                  {businessAddress.trim() !== "" && (
                    <Feather name="check" size={18} color={TOKENS.primary} style={styles.inputCheckmark} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.premiumNextBtn, !businessAddress.trim() && styles.premiumNextBtnDisabled]}
                  onPress={handleRegister}
                  disabled={!businessAddress.trim() || isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color={TOKENS.card} size="small" />
                  ) : (
                    <>
                      <Text style={styles.premiumNextBtnText}>Launch POS Terminal 🚀</Text>
                      <Feather name="check-circle" size={16} color={TOKENS.card} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  toastContainer: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    backgroundColor: TOKENS.dark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: "90%",
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: "600",
  },
  brandingWrapper: {
    alignItems: "center",
    marginBottom: 32,
    gap: 6,
  },
  logoSquare: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  appName: {
    fontSize: 22,
    fontWeight: "bold",
    color: TOKENS.dark,
    letterSpacing: 0.5,
  },
  appTagline: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  card: {
    backgroundColor: TOKENS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: TOKENS.muted,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.dark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hintMarker: {
    fontSize: 11,
    color: TOKENS.primary,
    fontWeight: "600",
  },
  phoneInputRow: {
    flexDirection: "row",
    height: 48,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
    marginBottom: 20,
  },
  countryCodeBox: {
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: TOKENS.border,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    color: TOKENS.dark,
    fontWeight: "600",
  },
  otpContainer: {
    width: "100%",
    position: "relative",
    height: 54,
    marginBottom: 24,
    justifyContent: "center",
  },
  hiddenOtpInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
    zIndex: 10,
  },
  otpSlotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  otpSlotBox: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  otpSlotBoxFilled: {
    borderColor: TOKENS.primary,
    backgroundColor: TOKENS.card,
  },
  otpSlotBoxFocused: {
    borderColor: TOKENS.primary,
    borderWidth: 2,
    backgroundColor: TOKENS.card,
  },
  otpSlotBoxError: {
    borderColor: TOKENS.error,
    backgroundColor: "#FDF2F2",
  },
  otpSlotText: {
    fontSize: 20,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  otpSlotTextError: {
    color: TOKENS.error,
  },
  submitButton: {
    flexDirection: "row",
    height: 48,
    backgroundColor: TOKENS.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.card,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backBtnText: {
    fontSize: 13,
    color: TOKENS.primary,
    fontWeight: "600",
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.dark,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: TOKENS.dark,
    backgroundColor: "#F9FAFB",
    fontWeight: "500",
  },
  formInputDisabled: {
    backgroundColor: "#F3F4F6",
    color: TOKENS.muted,
  },
  onboardingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    marginRight: 16,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: TOKENS.primary,
    borderRadius: 3,
  },
  stepIndicatorText: {
    fontSize: 14,
    fontWeight: "700",
    color: TOKENS.primary,
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: TOKENS.dark,
    lineHeight: 30,
    marginBottom: 8,
  },
  onboardingSubtitle: {
    fontSize: 13,
    color: TOKENS.muted,
    lineHeight: 18,
    marginBottom: 24,
  },
  premiumInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  premiumInputWrapperFocused: {
    borderColor: TOKENS.primary,
    backgroundColor: TOKENS.card,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  premiumTextInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: TOKENS.dark,
    fontWeight: "600",
  },
  inputCheckmark: {
    marginLeft: 10,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 32,
  },
  chipBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    gap: 8,
  },
  chipBoxSelected: {
    borderColor: TOKENS.primary,
    backgroundColor: "#EFF6FF",
  },
  chipEmoji: {
    fontSize: 15,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  chipTextSelected: {
    color: TOKENS.primary,
  },
  chipCheck: {
    marginLeft: 2,
  },
  premiumNextBtn: {
    flexDirection: "row",
    height: 48,
    backgroundColor: TOKENS.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  premiumNextBtnDisabled: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
    elevation: 0,
  },
  premiumNextBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: TOKENS.card,
  },
});
