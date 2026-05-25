import React, { useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "./styles";
import { TOKENS } from "../../constants/tokens";

const CATEGORIES = [
  { label: "Grocery", icon: "🛒" },
  { label: "Dairy", icon: "🥛" },
  { label: "Drinks", icon: "🥤" },
  { label: "Snacks", icon: "🍪" },
  { label: "Household", icon: "🏠" },
  { label: "Other", icon: "✨" },
];

interface RegisterBusinessPanelProps {
  phone: string;
  businessName: string;
  setBusinessName: (val: string) => void;
  newCategory: string;
  setNewCategory: (val: string) => void;
  businessAddress: string;
  setBusinessAddress: (val: string) => void;
  registerStep: 1 | 2 | 3;
  setRegisterStep: (step: 1 | 2 | 3) => void;
  isLoading: boolean;
  handleRegister: () => void;
  setStep: (step: "phone" | "otp" | "register") => void;
}

export function RegisterBusinessPanel({
  phone,
  businessName,
  setBusinessName,
  newCategory,
  setNewCategory,
  businessAddress,
  setBusinessAddress,
  registerStep,
  setRegisterStep,
  isLoading,
  handleRegister,
  setStep,
}: RegisterBusinessPanelProps) {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  return (
    <View style={styles.card}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => {
          if (registerStep === 1) {
            setStep("otp");
          } else {
            setRegisterStep((registerStep - 1) as 1 | 2 | 3);
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
            style={[
              styles.premiumNextBtn,
              businessName.trim() !== "" && styles.premiumNextBtnShadow,
              businessName.trim() === "" && styles.premiumNextBtnDisabled,
            ]}
            onPress={() => setRegisterStep(2)}
            disabled={businessName.trim() === ""}
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
            style={[
              styles.premiumNextBtn,
              newCategory !== "" && styles.premiumNextBtnShadow,
              newCategory === "" && styles.premiumNextBtnDisabled,
            ]}
            onPress={() => setRegisterStep(3)}
            disabled={newCategory === ""}
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
            style={[
              styles.premiumNextBtn,
              businessAddress.trim() !== "" && !isLoading && styles.premiumNextBtnShadow,
              businessAddress.trim() === "" && styles.premiumNextBtnDisabled,
            ]}
            onPress={handleRegister}
            disabled={businessAddress.trim() === "" || isLoading}
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
  );
}
