'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { CheckCircle } from 'lucide-react';
import { useSendOtp, useVerifyOtp } from '../../hooks/useAuth';
import './auth.css';

import { PhoneStep } from '../../components/auth/PhoneStep';
import { OtpStep } from '../../components/auth/OtpStep';

export default function AuthPage() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const loadBusinesses = useBusinessStore((s) => s.loadBusinessesFromDb);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);

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
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (step === 'otp' && resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, resendCooldown]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    const cleanPhone = normalizePhone(phone);
    try {
      const token = await sendOtpMutation.mutateAsync(cleanPhone);
      setVerificationToken(token || '');
      setOtpError('');
      setResendCooldown(30);
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
      setVerificationToken(token || '');
      setStep('otp');
      setResendCooldown(30);
      triggerToast('Verification code sent to +94 ' + phone);
    } catch (err: any) {
      triggerToast(err.message || 'Network error. Please try again.');
    }
  };

  const handleOtpVerify = async (code: string) => {
    if (loading) return;
    setOtpError('');
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
      setOtpError(err.message || 'Invalid OTP. Hint: Use 11111');
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
            setPhone={setPhone}
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
            onBack={() => setStep('phone')}
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
