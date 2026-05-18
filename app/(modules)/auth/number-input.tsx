import { Feather } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

export default function NumberInputRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(cartState.getIsLoggedIn());
  const [step, setStep] = useState<"phone" | "otp" | "register">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);

  // Registration fields
  const [businessName, setBusinessName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSendOtp = () => {
    const cleanPhone = phone.replace(/\s+/g, "");
    if (cleanPhone.length < 9) {
      triggerToast("Please enter a valid mobile number!");
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep("otp");
      setOtp("");
      triggerToast("Verification code sent to +94 " + phone);
    }, 800);
  };

  const handleVerifyOtp = (currentOtp?: string) => {
    const codeToVerify = currentOtp || otp;
    if (codeToVerify.length < 4) {
      triggerToast("Please enter a 4-digit code!");
      return;
    }
    setIsLoading(true);
    setOtpError(false);
    setTimeout(() => {
      setIsLoading(false);
      
      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, "");
        if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
        if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        return cleaned;
      };
      
      const cleanPhone = normalizePhone(phone);

      if (codeToVerify === "1111") {
        setOtpError(false);
        
        // Execute dynamic SQLite lookup to see if a staff member exists for this phone!
        const db = require('../../../components/data/db').default;
        const { Q } = require('@nozbe/watermelondb');
        
        db.get('employees').query().fetch().then(async (employees: any[]) => {
          const matchedEmployee = employees.find((emp: any) => {
            const dbPhoneClean = normalizePhone(emp.phone || "");
            return dbPhoneClean === cleanPhone;
          });
          
          if (matchedEmployee) {
            // Found employee! Retrieve their parent business
            const bizRelation = matchedEmployee.business;
            const activeBiz = await bizRelation.fetch();
            
            if (activeBiz) {
              const { useAuthStore } = require('../../../stores/useAuthStore');
              useAuthStore.getState().loginWithEmployee(
                cleanPhone,
                matchedEmployee.role || 'cashier',
                matchedEmployee.name || 'Staff Member',
                activeBiz.id,
                matchedEmployee.id
              );
              
              const { useBusinessStore } = require('../../../stores/useBusinessStore');
              useBusinessStore.getState().setActiveBusiness(activeBiz.id);
              await useBusinessStore.getState().loadBusinessesFromDb();
              
              triggerToast(`Welcome back, ${matchedEmployee.name}!`);
              router.replace("/(tabs)");
            } else {
              triggerToast("No business registered for this staff member!");
              setStep("register");
            }
          } else {
            // Not in staff: Check if direct business owner in businesses!
            db.get('businesses').query().fetch().then(async (businesses: any[]) => {
              const matchedBiz = businesses.find((biz: any) => {
                const dbPhoneClean = normalizePhone(biz.phoneNumber || "");
                return dbPhoneClean === cleanPhone;
              });
              
              if (matchedBiz) {
                const { useAuthStore } = require('../../../stores/useAuthStore');
                useAuthStore.getState().loginWithEmployee(
                  cleanPhone,
                  'admin',
                  'Owner / Admin',
                  matchedBiz.id,
                  'owner'
                );
                
                const { useBusinessStore } = require('../../../stores/useBusinessStore');
                useBusinessStore.getState().setActiveBusiness(matchedBiz.id);
                await useBusinessStore.getState().loadBusinessesFromDb();
                
                triggerToast("Welcome back to Shopbook!");
                router.replace("/(tabs)");
              } else {
                // New user! Go to registration onboarding!
                triggerToast("Number not registered. Let's create your shop profile!");
                setStep("register");
              }
            }).catch(() => {
              setStep("register");
            });
          }
        }).catch((err: any) => {
          console.error('Failed to lookup employee in SQLite:', err);
          setStep("register");
        });
      } else {
        setOtpError(true);
        triggerToast("Invalid OTP. Hint: Use 1111");
        setOtp("");
      }
    }, 800);
  };

  const handleRegister = async () => {
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
    try {
      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, "");
        if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
        if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        return cleaned;
      };
      
      const cleanPhone = normalizePhone(phone);
      
      // 1. Await database record insertion
      const db = require('../../../components/data/db').default;
      const { Q } = require('@nozbe/watermelondb');
      
      let newBizRecord: any;
      let newEmpRecord: any;
      
      await db.write(async () => {
        newBizRecord = await db.get('businesses').create((biz: any) => {
          biz.name = businessName;
          biz.businessType = newCategory;
          biz.address = businessAddress;
          biz.phoneNumber = cleanPhone; // Save normalized phone number
        });

        newEmpRecord = await db.get('employees').create((emp: any) => {
          emp.business.set(newBizRecord);
          emp.name = "Owner / Admin";
          emp.role = "admin";
          emp.phone = cleanPhone; // Save normalized phone number
        });
      });
      
      console.log('Successfully registered business and owner employee in SQLite:', newBizRecord.id);
      
      // Seed products ONLY for the very first registered store in SQLite!
      const dbBizs = await db.get('businesses').query().fetch();
      if (dbBizs.length === 1) {
        console.log('Seeding initial products for the first store...');
        const SEEDING_PRODUCTS = [
          { name: "Anchor Milk 1L", price: 680, category: "dairy", icon: "🥛", stockCount: 24, unitType: "Liters", costPrice: 580, quickCode: "1001" },
          { name: "Highland Yogurt", price: 95, category: "dairy", icon: "🥣", stockCount: 38, unitType: "Pieces", costPrice: 75, quickCode: "1008" },
          { name: "Marie Biscuits", price: 180, category: "snacks", icon: "🍪", stockCount: 4, unitType: "Packets", costPrice: 140, quickCode: "1002" },
          { name: "Lemon Puff 200g", price: 250, category: "snacks", icon: "🥮", stockCount: 16, unitType: "Packets", costPrice: 200, quickCode: "1004" },
          { name: "Cream Soda 1.5L", price: 320, category: "drinks", icon: "🥤", stockCount: 22, unitType: "Liters", costPrice: 260, quickCode: "1003" },
          { name: "Pepsi 1L", price: 280, category: "drinks", icon: "🥤", stockCount: 0, unitType: "Liters", costPrice: 220, quickCode: "1009" },
          { name: "Sunlight Soap", price: 130, category: "grocery", icon: "🧼", stockCount: 15, unitType: "Pieces", costPrice: 100, quickCode: "1005" },
          { name: "Red Rice 1kg", price: 280, category: "grocery", icon: "🌾", stockCount: 18, unitType: "kg", costPrice: 230, quickCode: "1006" },
          { name: "Ceylon Tea", price: 450, category: "drinks", icon: "☕", stockCount: 2, unitType: "Packets", costPrice: 380, quickCode: "1007" },
          { name: "Bread Loaf", price: 110, category: "grocery", icon: "🍞", stockCount: 12, unitType: "Pieces", costPrice: 85, quickCode: "1010" },
        ];
        
        await db.write(async () => {
          for (const item of SEEDING_PRODUCTS) {
            await db.get('products').create((p: any) => {
              p.business.set(newBizRecord);
              p.name = item.name;
              p.price = item.price;
              p.category = item.category;
              p.icon = item.icon;
              p.stockCount = item.stockCount;
              p.unitType = item.unitType;
              p.costPrice = item.costPrice;
              p.quickCode = item.quickCode;
            });
          }
        });
      }
      
      // 2. Perform dynamic login & update session state immediately
      const { useAuthStore } = require('../../../stores/useAuthStore');
      useAuthStore.getState().loginWithEmployee(
        cleanPhone,
        'admin',
        'Owner / Admin',
        newBizRecord.id,
        newEmpRecord.id
      );
      
      // 3. Hydrate businesses list in SQLite store
      const { useBusinessStore } = require('../../../stores/useBusinessStore');
      await useBusinessStore.getState().loadBusinessesFromDb();
      useBusinessStore.getState().setActiveBusiness(newBizRecord.id);
      
      setIsLoading(false);
      triggerToast("Account registered and logged in successfully! 🎉");
      router.replace("/(tabs)");
    } catch (err) {
      console.error('Failed to register business in SQLite:', err);
      setIsLoading(false);
      triggerToast("Failed to create profile. Please try again.");
    }
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
          <Text style={styles.appName}>Shopbook POS</Text>
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
            <Text style={styles.cardTitle}>Register Shop Details</Text>
            <Text style={styles.cardSubtitle}>
              No profile found for +94 {phone}. Fill in your active retail business details to initialize this terminal.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Business / Brand Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Shopbook Retail Store"
                placeholderTextColor="#9CA3AF"
                value={businessName}
                onChangeText={setBusinessName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Business Category / Type</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Electronics, Clothing, Groceries"
                placeholderTextColor="#9CA3AF"
                value={newCategory}
                onChangeText={setNewCategory}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Store Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 142 Galle Road, Colombo 03"
                placeholderTextColor="#9CA3AF"
                value={businessAddress}
                onChangeText={setBusinessAddress}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Registered Phone Number</Text>
              <TextInput
                style={[styles.formInput, styles.formInputDisabled]}
                value={"+94 " + phone}
                editable={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (!businessName.trim() || !newCategory.trim() || !businessAddress.trim()) && styles.submitButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleRegister}
              disabled={!businessName.trim() || !newCategory.trim() || !businessAddress.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={TOKENS.card} size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Register & Log In</Text>
                  <Feather name="check-circle" size={16} color={TOKENS.card} />
                </>
              )}
            </TouchableOpacity>
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
});
