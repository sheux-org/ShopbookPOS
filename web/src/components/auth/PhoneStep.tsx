'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

interface PhoneStepProps {
  phone: string;
  setPhone: (val: string) => void;
  loading: boolean;
  normalizePhone: (phoneStr: string) => string;
  onSubmit: (e: React.FormEvent) => void;
}

export const PhoneStep: React.FC<PhoneStepProps> = ({
  phone,
  setPhone,
  loading,
  normalizePhone,
  onSubmit,
}) => {
  const isInvalidPhone = normalizePhone(phone).length !== 9;

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <div className="auth-input-group">
        <label className="auth-label">Phone Number</label>
        <input
          type="tel"
          placeholder="eg: 07X XXX XXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          disabled={loading}
          className="auth-input"
        />
      </div>
      <button
        type="submit"
        disabled={isInvalidPhone || loading}
        className={`auth-button ${isInvalidPhone || loading ? 'disabled' : ''}`}
      >
        <span>{loading ? 'Sending Code...' : 'Send OTP Verification'}</span>
        <ArrowRight size={16} />
      </button>
    </form>
  );
};
