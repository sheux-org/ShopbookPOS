'use client';

import React, { useReducer, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { CheckCircle } from 'lucide-react';
import { useSendOtp, useVerifyOtp } from '../../hooks/useAuth';
import './auth.css';

import { PhoneStep } from '../../components/auth/PhoneStep';
import { OtpStep } from '../../components/auth/OtpStep';

type AuthStep = 'phone' | 'otp';

interface AuthState {
  step: AuthStep;
  phone: string;
  otpError: string;
  verificationToken: string;
  toastMessage: string | null;
  resendCooldown: number;
}

type AuthAction =
  | { type: 'setStep'; step: AuthStep }
  | { type: 'setPhone'; phone: string }
  | { type: 'setOtpError'; otpError: string }
  | { type: 'setVerificationToken'; token: string }
  | { type: 'showToast'; message: string }
  | { type: 'clearToast' }
  | { type: 'setResendCooldown'; cooldown: number }
  | { type: 'decrementResendCooldown' }
  | { type: 'enterOtpStep'; token: string };

const initialAuthState: AuthState = {
  step: 'phone',
  phone: '',
  otpError: '',
  verificationToken: '',
  toastMessage: null,
  resendCooldown: 30,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'setStep':
      return { ...state, step: action.step };
    case 'setPhone':
      return { ...state, phone: action.phone };
    case 'setOtpError':
      return { ...state, otpError: action.otpError };
    case 'setVerificationToken':
      return { ...state, verificationToken: action.token };
    case 'showToast':
      return { ...state, toastMessage: action.message };
    case 'clearToast':
      return { ...state, toastMessage: null };
    case 'setResendCooldown':
      return { ...state, resendCooldown: action.cooldown };
    case 'decrementResendCooldown':
      return { ...state, resendCooldown: state.resendCooldown - 1 };
    case 'enterOtpStep':
      return {
        ...state,
        verificationToken: action.token,
        step: 'otp',
        resendCooldown: 30,
      };
    default:
      return state;
  }
}

export default function AuthPage() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const loadBusinesses = useBusinessStore((s) => s.loadBusinessesFromDb);

  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const { step, phone, otpError, verificationToken, toastMessage, resendCooldown } = state;

  // Mutations
  const sendOtpMutation = useSendOtp();
  const verifyOtpMutation = useVerifyOtp();

  const loading = sendOtpMutation.isPending || verifyOtpMutation.isPending;

  useEffect(() => {
    if (isLoggedIn) {
      // Check if user has businesses registered
      loadBusinesses().then(() => {
        const list = useBusinessStore.getState().businesses;
        const active = useBusinessStore.getState().activeBusiness;
        if (list.length > 0 && active && active.id !== '0') {
          router.push('/');
        } else {
          triggerToast('Account onboarding is incomplete. Please register using the mobile app.');
          useAuthStore.getState().logout();
        }
      });
    }
  }, [isLoggedIn, loadBusinesses, router]);

  const triggerToast = (msg: string) => {
    dispatch({ type: 'showToast', message: msg });
    setTimeout(() => dispatch({ type: 'clearToast' }), 2500);
  };

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (step === 'otp' && resendCooldown > 0) {
      const timer = setTimeout(() => dispatch({ type: 'decrementResendCooldown' }), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, resendCooldown]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    const cleanPhone = normalizePhone(phone);
    try {
      const token = await sendOtpMutation.mutateAsync(cleanPhone);
      dispatch({ type: 'setVerificationToken', token: token || '' });
      dispatch({ type: 'setOtpError', otpError: '' });
      dispatch({ type: 'setResendCooldown', cooldown: 30 });
      triggerToast('Verification code resent to +94 ' + phone);
    } catch (err: any) {
      triggerToast(err.message || 'Network error. Please try again.');
    }
  };

  const normalizePhone = (phoneStr: string): string => {
    let cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    return cleaned;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length !== 9) {
      triggerToast('Please enter a valid mobile number!');
      return;
    }
    try {
      const token = await sendOtpMutation.mutateAsync(cleanPhone);
      dispatch({ type: 'enterOtpStep', token: token || '' });
      triggerToast('Verification code sent to +94 ' + phone);
    } catch (err: any) {
      triggerToast(err.message || 'Network error. Please try again.');
    }
  };

  const handleOtpVerify = async (code: string) => {
    if (loading) return;
    dispatch({ type: 'setOtpError', otpError: '' });
    if (code.length < 5) {
      triggerToast('Please enter a 5-digit code!');
      return;
    }

    try {
      const result = await verifyOtpMutation.mutateAsync({
        phone,
        otp: code,
        verificationToken,
      });

      if (result.status === 'success') {
        triggerToast('Welcome back to Mini POS!');
        router.push('/');
      } else {
        triggerToast(
          'Account not found. Please use the mobile app to create an account. Web terminal registration is not supported.'
        );
      }
    } catch (err: any) {
      dispatch({ type: 'setOtpError', otpError: err.message || 'Invalid OTP. Hint: Use 11111' });
    }
  };

  return (
    <div className="auth-container">
      {/* Toast popup */}
      {toastMessage && (
        <div className="auth-toast">
          <CheckCircle size={16} color="#FFFFFF" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="auth-card">
        {/* Brand Icon/Header */}
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <img
              src="/logo.png"
              alt="Shopbook Logo"
              className="auth-logo-image"
              fetchPriority="high"
            />
          </div>
          <h2 className="auth-title">Shopbook Mini POS</h2>
          <p className="auth-subtitle">Premium Web Billing Terminal</p>
        </div>

        {step === 'phone' ? (
          <PhoneStep
            phone={phone}
            setPhone={(value) => dispatch({ type: 'setPhone', phone: value })}
            loading={loading}
            normalizePhone={normalizePhone}
            onSubmit={handlePhoneSubmit}
          />
        ) : (
          <OtpStep
            phone={phone}
            loading={loading}
            otpError={otpError}
            onVerify={handleOtpVerify}
            onResend={handleResendOtp}
            resendCooldown={resendCooldown}
            onBack={() => dispatch({ type: 'setStep', step: 'phone' })}
          />
        )}

        {/* Powered by Shopbook (positioned inside the card at the bottom) */}
        <div className="auth-powered-by">
          <span className="auth-powered-by-text">powered by</span>
          <a
            href="https://shopbook.lk"
            target="_blank"
            rel="noopener noreferrer"
            className="auth-powered-by-brand"
          >
            Shopbook
          </a>
        </div>
      </div>
    </div>
  );
}
