import React from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "./styles";
import { TOKENS } from "../../constants/tokens";

interface PhoneInputPanelProps {
  phone: string;
  setPhone: (val: string) => void;
  isLoading: boolean;
  handleSendOtp: () => void;
}

export function PhoneInputPanel({
  phone,
  setPhone,
  isLoading,
  handleSendOtp,
}: PhoneInputPanelProps) {
  const isSubmitDisabled = phone.replace(/\D/g, "").length < 9 || isLoading;

  return (
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
          placeholder="7X XXX XXXX"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={12}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitDisabled && styles.submitButtonDisabled]}
        activeOpacity={0.8}
        onPress={handleSendOtp}
        disabled={isSubmitDisabled}
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
  );
}
