import React from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "./styles";
import { TOKENS } from "../../constants/tokens";

interface OtpVerifyPanelProps {
  phone: string;
  otp: string;
  setOtp: (val: string) => void;
  otpError: boolean;
  setOtpError: (val: boolean) => void;
  isLoading: boolean;
  handleVerifyOtp: (val?: string) => void;
  setStep: (step: "phone" | "otp" | "register") => void;
}

export function OtpVerifyPanel({
  phone,
  otp,
  setOtp,
  otpError,
  setOtpError,
  isLoading,
  handleVerifyOtp,
  setStep,
}: OtpVerifyPanelProps) {
  const isOtpValid = otp.length >= 5;
  const isSubmitDisabled = !isOtpValid || isLoading;

  return (
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
        We sent a 5-digit verification code to +94 {phone}. Enter it below to unlock.
      </Text>

      <Text style={styles.inputLabel}>5-Digit OTP Code</Text>

      <View style={styles.otpContainer}>
        {/* Hidden absolute invisible TextInput for native keyboard */}
        <TextInput
          style={styles.hiddenOtpInput}
          keyboardType="number-pad"
          maxLength={5}
          value={otp}
          onChangeText={(val) => {
            setOtp(val);
            if (otpError) setOtpError(false);
            if (val.length === 5) {
              handleVerifyOtp(val);
            }
          }}
          autoFocus={true}
        />

        {/* 5 Premium individual digit slot boxes */}
        <View style={styles.otpSlotsRow}>
          {[0, 1, 2, 3, 4].map((idx) => {
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
        style={[
          styles.submitButton,
          isOtpValid && !isLoading && styles.submitButtonShadow,
          !isOtpValid && styles.submitButtonDisabled,
        ]}
        activeOpacity={0.8}
        onPress={() => handleVerifyOtp()}
        disabled={isSubmitDisabled}
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
  );
}
