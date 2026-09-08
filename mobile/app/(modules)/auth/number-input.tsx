import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cartState } from '../../../components/data/cartState';
import { TOKENS } from '../../../constants/tokens';
import { useRegisterUser, useVerifyOtp } from '../../../hooks/useAuth';

import { OtpVerifyPanel } from '../../../components/auth/OtpVerifyPanel';
import { PhoneInputPanel } from '../../../components/auth/PhoneInputPanel';
import { RegisterBusinessPanel } from '../../../components/auth/RegisterBusinessPanel';
import { styles } from '../../../components/auth/styles';
import { PoweredBy } from '../../../components/common/PoweredBy';

export default function NumberInputRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(cartState.getIsLoggedIn());
  const [step, setStep] = useState<'phone' | 'otp' | 'register'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<boolean>(false);
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [, setHasAccount] = useState<boolean>(true);

  const [businessName, setBusinessName] = useState<string>('');
  const [businessType, setBusinessType] = useState<string>('');
  const [businessAddress, setBusinessAddress] = useState<string>('');
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const handleSendOtp = async () => {
    const normalizePhone = (phoneStr: string): string => {
      let cleaned = phoneStr.replace(/\D/g, '');
      if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
      if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
      return cleaned;
    };

    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 9) {
      triggerToast('Please enter a valid mobile number!');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://mini-pos-sync-server.vercel.app/api/v1/auth/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone_number: cleanPhone }),
      });

      if (response.status === 429) {
        throw new Error(
          'Too many requests. You have exceeded the login limit. Please try again in a little while.'
        );
      }

      if (!response.ok) {
        throw new Error('Failed to check phone number. Please try again.');
      }

      const data = await response.json();
      setIsLoading(false);

      setVerificationToken(data.token || '');
      setHasAccount(!!data.hasAccount);
      setStep('otp');
      setOtp('');
      triggerToast('Verification code sent to +94 ' + phone);
    } catch (err: any) {
      setIsLoading(false);
      triggerToast(err.message || 'Network error. Please try again.');
    }
  };

  const handleVerifyOtp = (currentOtp?: string) => {
    const codeToVerify = currentOtp || otp;
    if (codeToVerify.length < 5) {
      triggerToast('Please enter a 5-digit code!');
      return;
    }
    setIsLoading(true);
    setOtpError(false);

    verifyOtpMutation.mutate(
      {
        phone,
        otp: codeToVerify,
        token: verificationToken,
      },
      {
        onSuccess: (data) => {
          setIsLoading(false);
          if (data.status === 'success') {
            setOtpError(false);
            triggerToast('Welcome back to Shopbook POS!');
            router.replace('/(tabs)');
          } else {
            triggerToast("Number verified. Let's create your shop profile!");
            setStep('register');
          }
        },
        onError: (err: any) => {
          setIsLoading(false);
          setOtpError(true);
          triggerToast(err.message || 'Invalid OTP code!');
          setOtp('');
        },
      }
    );
  };

  const handleRegister = () => {
    if (!businessName.trim()) {
      triggerToast('Please enter your Shop/Business Name!');
      return;
    }
    if (!businessType.trim()) {
      triggerToast('Please select business type!');
      return;
    }
    if (!businessAddress.trim()) {
      triggerToast('Please enter your Store Address!');
      return;
    }

    setIsLoading(true);
    registerUserMutation.mutate(
      {
        phone,
        businessName: businessName.trim(),
        category: businessType.trim(),
        address: businessAddress.trim(),
      },
      {
        onSuccess: () => {
          setIsLoading(false);
          triggerToast('Account registered and logged in successfully! 🎉');
          router.replace('/(tabs)');
        },
        onError: (err: any) => {
          console.error('Failed to register business in SQLite:', err);
          setIsLoading(false);
          triggerToast('Failed to create profile. Please try again.');
        },
      }
    );
  };

  if (isLoggedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 64 },
          ]}
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
              <Image
                source={require('../../../assets/images/splash-icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>Shopbook POS</Text>
            <Text style={styles.appTagline}>Sleek & Modular Retail Terminal</Text>
          </View>

          {/* Dynamic Step Panels */}
          {step === 'phone' && (
            <PhoneInputPanel
              phone={phone}
              setPhone={setPhone}
              isLoading={isLoading}
              handleSendOtp={handleSendOtp}
            />
          )}

          {step === 'otp' && (
            <OtpVerifyPanel
              phone={phone}
              otp={otp}
              setOtp={setOtp}
              otpError={otpError}
              setOtpError={setOtpError}
              isLoading={isLoading}
              handleVerifyOtp={handleVerifyOtp}
              setStep={setStep}
            />
          )}

          {step === 'register' && (
            <RegisterBusinessPanel
              phone={phone}
              businessName={businessName}
              setBusinessName={setBusinessName}
              businessType={businessType}
              setBusinessType={setBusinessType}
              businessAddress={businessAddress}
              setBusinessAddress={setBusinessAddress}
              registerStep={registerStep}
              setRegisterStep={setRegisterStep}
              isLoading={isLoading}
              handleRegister={handleRegister}
              setStep={setStep}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* PoweredBy placed at the absolute bottom, outside KeyboardAvoidingView so it does NOT push up with the keyboard */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 0, right: 0 }}>
        <PoweredBy showPro={false} />
      </View>
    </View>
  );
}
