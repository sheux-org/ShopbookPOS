'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { ArrowRight, MessageSquare, CheckCircle } from 'lucide-react';
import { useSendOtp, useVerifyOtp } from '../../hooks/useAuth';

export default function AuthPage() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const loadBusinesses = useBusinessStore((s) => s.loadBusinessesFromDb);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Separate inputs for 5-digit OTP
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

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
          triggerToast("Account onboarding is incomplete. Please register using the mobile app.");
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

  // Focus the first input automatically when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 50);
    }
  }, [step]);

  const handleOtpDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);
    const fullOtp = newDigits.join('');
    setOtp(fullOtp);

    // Auto-focus next input
    if (cleanVal && index < 4) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto verify when 5 digits are entered
    if (fullOtp.length === 5) {
      handleOtpSubmit(undefined, fullOtp);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        setOtp(newDigits.join(''));
        otpRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
        setOtp(newDigits.join(''));
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5);
    if (pastedData.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 5; i++) {
        if (pastedData[i]) {
          newDigits[i] = pastedData[i];
        }
      }
      setOtpDigits(newDigits);
      const fullOtp = newDigits.join('');
      setOtp(fullOtp);

      const nextFocusIndex = Math.min(pastedData.length, 4);
      otpRefs.current[nextFocusIndex]?.focus();

      if (fullOtp.length === 5) {
        handleOtpSubmit(undefined, fullOtp);
      }
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    const cleanPhone = normalizePhone(phone);
    try {
      const token = await sendOtpMutation.mutateAsync(cleanPhone);
      setVerificationToken(token || "");
      setOtp('');
      setOtpDigits(['', '', '', '', '']);
      setResendCooldown(30);
      triggerToast("Verification code resent to +94 " + phone);

      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 50);
    } catch (err: any) {
      triggerToast(err.message || "Network error. Please try again.");
    }
  };

  const normalizePhone = (phoneStr: string): string => {
    let cleaned = phoneStr.replace(/\D/g, "");
    if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    return cleaned;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length !== 9) {
      triggerToast("Please enter a valid mobile number!");
      return;
    }
    try {
      const token = await sendOtpMutation.mutateAsync(cleanPhone);
      setVerificationToken(token || "");
      setStep('otp');
      setOtp('');
      setOtpDigits(['', '', '', '', '']);
      setResendCooldown(30);
      triggerToast("Verification code sent to +94 " + phone);
    } catch (err: any) {
      triggerToast(err.message || "Network error. Please try again.");
    }
  };

  const handleOtpSubmit = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    if (loading) return;
    setOtpError('');
    const codeToVerify = codeOverride || otp;
    if (codeToVerify.length < 5) {
      triggerToast("Please enter a 5-digit code!");
      return;
    }

    try {
      const result = await verifyOtpMutation.mutateAsync({
        phone,
        otp: codeToVerify,
        verificationToken,
      });

      if (result.status === "success") {
        triggerToast("Welcome back to Mini POS!");
        router.push('/');
      } else {
        triggerToast("Account not found. Please use the mobile app to create an account. Web terminal registration is not supported.");
        setOtp('');
      }
    } catch (err: any) {
      setOtpError(err.message || "Invalid OTP. Hint: Use 11111");
      setOtp('');
    }
  };


  return (
    <div style={styles.container} className="fade-in">
      {/* Toast popup */}
      {toastMessage && (
        <div style={styles.toast}>
          <CheckCircle size={16} color="#FFFFFF" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div style={styles.card}>
        {/* Brand Icon/Header */}
        <div style={styles.header}>
          <div style={styles.logoWrapper}>
            <img
              src="/logo.png"
              alt="Shopbook Logo"
              style={styles.logoImage}
            />
          </div>
          <h2 style={styles.title}>Shopbook Mini POS</h2>
          <p style={styles.subtitle}>Premium Web Billing Terminal</p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Phone Number</label>
              <input
                type="tel"
                placeholder="eg: 07X XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
                style={styles.input}
              />
            </div>
            <button
              type="submit"
              disabled={normalizePhone(phone).length !== 9 || loading}
              style={{
                ...styles.button,
                ...(normalizePhone(phone).length !== 9 || loading ? styles.buttonDisabled : {}),
              }}
            >
              <span>{loading ? 'Sending Code...' : 'Send OTP Verification'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} style={styles.form}>
            <div style={styles.infoBox}>
              <MessageSquare size={16} color="var(--primary)" />
              <p style={styles.infoText}>We sent a verification code to {phone}</p>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>5-Digit Verification Code</label>
              <div style={styles.otpInputContainer}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    ref={(el) => { otpRefs.current[idx] = el; }}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    onFocus={() => setFocusedIndex(idx)}
                    onBlur={() => setFocusedIndex(null)}
                    required
                    disabled={loading}
                    style={{
                      ...styles.otpDigitInput,
                      ...(focusedIndex === idx ? styles.otpDigitInputFocus : {})
                    }}
                  />
                ))}
              </div>
              {otpError && <p style={styles.errorText}>{otpError}</p>}
            </div>

            {/* Resend OTP Cooldown Section */}
            <div style={styles.resendContainer}>
              <span style={styles.resendText}>Didn't receive the code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                style={{
                  ...styles.resendBtn,
                  ...(resendCooldown > 0 || loading ? styles.resendBtnDisabled : {})
                }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </div>

            <div style={styles.otpBtnGroup}>
              <button
                type="button"
                onClick={() => setStep('phone')}
                disabled={loading}
                style={styles.backBtn}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={otp.length !== 5 || loading}
                style={{
                  ...styles.button,
                  flex: 1,
                  ...(otp.length !== 5 || loading ? styles.buttonDisabled : {}),
                }}
              >
                <span>{loading ? 'Verifying...' : 'Verify & Log In'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Powered by Shopbook */}
        <div style={styles.poweredByContainer}>
          <span style={styles.poweredByText}>powered by</span>
          <span style={styles.poweredByBrand}>Shopbook</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top right, #eff6ff 0%, #f9fafb 60%)',
    padding: '24px',
    minHeight: '100vh',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    padding: '28px 24px 20px 24px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '20px',
  },
  logoWrapper: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.08)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  logoImage: {
    width: '130%',
    height: '130%',
    objectFit: 'contain',
  },
  title: {
    fontSize: '20px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '4px',
    fontWeight: '600',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    color: 'var(--dark)',
    backgroundColor: 'var(--background)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    color: 'var(--dark)',
    backgroundColor: 'var(--background)',
    outline: 'none',
    cursor: 'pointer',
  },
  button: {
    width: '100%',
    padding: '14px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 6px rgba(37, 99, 235, 0.15)',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  infoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: 'var(--light-blue)',
    borderRadius: '8px',
    border: '1px solid var(--accent-blue)',
  },
  infoText: {
    fontSize: '11px',
    color: 'var(--primary)',
    fontWeight: '600',
  },
  errorText: {
    fontSize: '11px',
    color: 'var(--error)',
    marginTop: '4px',
    fontWeight: '600',
  },
  otpBtnGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '8px',
  },
  backBtn: {
    padding: '12px 18px',
    borderRadius: 'var(--radius)',
    backgroundColor: '#f3f4f6',
    color: 'var(--dark)',
    border: 'none',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
  },
  registerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
  },
  registerTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  registerSub: {
    fontSize: '12px',
    color: 'var(--muted)',
    lineHeight: '1.5',
    marginBottom: '8px',
  },
  poweredByContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    marginTop: '24px',
  },
  poweredByText: {
    fontSize: '12px',
    color: 'var(--muted)',
  },
  poweredByBrand: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--primary)',
    letterSpacing: '0.5px',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '30px',
    fontWeight: 'bold',
    fontSize: '13px',
    zIndex: 99999,
    boxShadow: '0 10px 20px rgba(37, 99, 235, 0.25)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  otpInputContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '8px',
  },
  otpDigitInput: {
    width: '46px',
    height: '46px',
    borderRadius: 'var(--radius)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    fontSize: '20px',
    fontWeight: '800',
    textAlign: 'center',
    color: 'var(--dark)',
    backgroundColor: 'var(--background)',
    outline: 'none',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  otpDigitInputFocus: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
    backgroundColor: '#ffffff',
  },
  resendContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '6px',
    fontSize: '13px',
  },
  resendText: {
    color: 'var(--muted)',
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0,
    fontSize: '13px',
    textDecoration: 'underline',
    outline: 'none',
  },
  resendBtnDisabled: {
    color: 'var(--muted)',
    cursor: 'not-allowed',
    textDecoration: 'none',
  },
};
