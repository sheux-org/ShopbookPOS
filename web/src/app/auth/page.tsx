'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { Store, Shield, ArrowRight, MessageSquare, CheckCircle } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const login = useAuthStore((s) => s.login);
  const userPhone = useAuthStore((s) => s.userPhone);
  const registerBusiness = useBusinessStore((s) => s.registerBusiness);
  const loadBusinesses = useBusinessStore((s) => s.loadBusinessesFromDb);
  const businesses = useBusinessStore((s) => s.businesses);

  const [step, setStep] = useState<'phone' | 'otp' | 'register'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  // Register Business fields
  const [bizName, setBizName] = useState('');
  const [bizCategory, setBizCategory] = useState('General Retail');
  const [bizAddress, setBizAddress] = useState('');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      // Check if user has businesses registered
      loadBusinesses().then(() => {
        const list = useBusinessStore.getState().businesses;
        const active = useBusinessStore.getState().activeBusiness;
        if (list.length > 0 && active && active.id !== '0') {
          router.push('/');
        } else {
          setStep('register');
        }
      });
    }
  }, [isLoggedIn, loadBusinesses, router]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 8) return;
    setStep('otp');
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    const success = login(phone, otp);
    if (!success) {
      setOtpError('Invalid verification code. Try "11111" for testing.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName || !bizAddress) return;
    setRegistering(true);
    try {
      await registerBusiness(bizName, bizAddress, phone, bizCategory);
      // Wait for store profiles to load
      await loadBusinesses();
      router.push('/');
    } catch (err) {
      console.error(err);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.card}>
        {/* Brand Icon/Header */}
        <div style={styles.header}>
          <div style={styles.logo}>S</div>
          <h2 style={styles.title}>Shopbook Mini POS</h2>
          <p style={styles.subtitle}>Premium Web Billing Terminal</p>
        </div>

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. +94 77 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={styles.input}
              />
            </div>
            <button
              type="submit"
              disabled={phone.length < 8}
              style={{
                ...styles.button,
                ...(phone.length < 8 ? styles.buttonDisabled : {}),
              }}
            >
              <span>Send OTP Verification</span>
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
              <input
                type="text"
                maxLength={5}
                placeholder="Enter 11111 to bypass"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                style={styles.input}
              />
              {otpError && <p style={styles.errorText}>{otpError}</p>}
            </div>

            <div style={styles.otpBtnGroup}>
              <button
                type="button"
                onClick={() => setStep('phone')}
                style={styles.backBtn}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={otp.length !== 5}
                style={{
                  ...styles.button,
                  flex: 1,
                  ...(otp.length !== 5 ? styles.buttonDisabled : {}),
                }}
              >
                Verify & Log In
              </button>
            </div>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegisterSubmit} style={styles.form}>
            <div style={styles.registerHeader}>
              <Store size={22} color="var(--primary)" />
              <h3 style={styles.registerTitle}>Onboard Your Shop</h3>
            </div>
            <p style={styles.registerSub}>Let's configure your basic store details to build your invoice catalog.</p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Business / Store Name</label>
              <input
                type="text"
                placeholder="e.g. Royal Bakery"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                required
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Business Category</label>
              <select
                value={bizCategory}
                onChange={(e) => setBizCategory(e.target.value)}
                style={styles.select}
              >
                <option value="General Retail">General Retail</option>
                <option value="Grocery Store">Grocery Store</option>
                <option value="Boutique / Apparel">Boutique / Apparel</option>
                <option value="Restaurant / Cafe">Restaurant / Cafe</option>
                <option value="Pharmacy">Pharmacy</option>
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Physical Address</label>
              <input
                type="text"
                placeholder="e.g. 102 Galle Road, Colombo 03"
                value={bizAddress}
                onChange={(e) => setBizAddress(e.target.value)}
                required
                style={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={registering || !bizName || !bizAddress}
              style={{
                ...styles.button,
                ...(registering || !bizName || !bizAddress ? styles.buttonDisabled : {}),
              }}
            >
              <span>{registering ? 'Creating Store Profiles...' : 'Initialize Billing Workspace'}</span>
              <CheckCircle size={16} />
            </button>
          </form>
        )}

        {/* Security badge footer */}
        <div style={styles.footer}>
          <Shield size={14} color="var(--muted)" />
          <span>Secured Terminal · Sri Lanka</span>
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
    padding: '36px',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '28px',
  },
  logo: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '26px',
    marginBottom: '16px',
    boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)',
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
    gap: '18px',
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
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '32px',
    fontSize: '11px',
    color: 'var(--muted)',
    fontWeight: '500',
  },
};
