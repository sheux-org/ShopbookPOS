'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';

interface OtpStepProps {
  phone: string;
  loading: boolean;
  otpError: string;
  onVerify: (code: string) => void;
  onResend: () => void;
  resendCooldown: number;
  onBack: () => void;
}

export const OtpStep: React.FC<OtpStepProps> = ({
  phone,
  loading,
  otpError,
  onVerify,
  onResend,
  resendCooldown,
  onBack,
}) => {
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first input automatically when entering OTP step
  useEffect(() => {
    setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 50);
  }, []);

  const handleOtpDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);
    const fullOtp = newDigits.join('');

    // Auto-focus next input
    if (cleanVal && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto verify when 6 digits are entered
    if (fullOtp.length === 6) {
      onVerify(fullOtp);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        otpRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        if (pastedData[i]) {
          newDigits[i] = pastedData[i];
        }
      }
      setOtpDigits(newDigits);
      const fullOtp = newDigits.join('');

      const nextFocusIndex = Math.min(pastedData.length, 5);
      otpRefs.current[nextFocusIndex]?.focus();

      if (fullOtp.length === 6) {
        onVerify(fullOtp);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length === 6) {
      onVerify(fullOtp);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-info-box">
        <MessageSquare size={16} color="var(--primary)" />
        <p className="auth-info-text">We sent a verification code to {phone}</p>
      </div>

      <div className="auth-input-group">
        <label className="auth-label">5-Digit Verification Code</label>
        <div className="otp-input-container">
          {otpDigits.map((digit, idx) => (
            <input
              key={idx}
              type="text"
              maxLength={1}
              value={digit}
              ref={(el) => {
                otpRefs.current[idx] = el;
              }}
              onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
              onPaste={handleOtpPaste}
              onFocus={() => setFocusedIndex(idx)}
              onBlur={() => setFocusedIndex(null)}
              required
              disabled={loading}
              className={`otp-digit-input ${focusedIndex === idx ? 'focus' : ''}`}
            />
          ))}
        </div>
        {otpError && <p className="auth-error-text">{otpError}</p>}
      </div>

      {/* Resend OTP Cooldown Section */}
      <div className="resend-container">
        <span className="resend-text">Didn't receive the code?</span>
        <button
          type="button"
          onClick={onResend}
          disabled={resendCooldown > 0 || loading}
          className={`resend-btn ${resendCooldown > 0 || loading ? 'disabled' : ''}`}
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
        </button>
      </div>

      <div className="otp-btn-group">
        <button type="button" onClick={onBack} disabled={loading} className="auth-back-btn">
          Back
        </button>
        <button
          type="submit"
          disabled={otpDigits.join('').length !== 5 || loading}
          className={`auth-button ${otpDigits.join('').length !== 5 || loading ? 'disabled' : ''}`}
          style={{ flex: 1 }}
        >
          <span>{loading ? 'Verifying...' : 'Verify & Log In'}</span>
        </button>
      </div>
    </form>
  );
};
