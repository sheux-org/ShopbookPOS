'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Diamond, Smartphone, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useEntitlementStore } from '../../stores/useEntitlementStore';
import { deleteCurrentDeviceSession } from '../../hooks/useActiveDeviceTracker';

/**
 * Full-page gate for the web terminal, which is itself a Pro feature.
 * Purchase happens in the mobile app — deliberately no CTA to buy here.
 * Provides a clear Log Out / Switch Account option so users can switch accounts.
 */
export const ProBlocker: React.FC<{ businessName?: string | null }> = ({ businessName }) => {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    try {
      await deleteCurrentDeviceSession();
    } catch (e) {
      console.warn('Error clearing device session:', e);
    }
    useEntitlementStore.getState().reset();
    logout();
    router.replace('/auth');
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '24px',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {/* Top right quick sign out */}
      <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
        <button
          onClick={handleLogout}
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backdropFilter: 'blur(8px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.borderColor = '#fca5a5';
            e.currentTarget.style.background = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#64748b';
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
          }}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>

      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
          padding: '40px 32px',
          maxWidth: '460px',
          width: '100%',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Diamond size={26} color="#D97706" />
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
          Web terminal is a Shopbook POS Pro feature
        </h1>

        <p style={{ fontSize: '14px', lineHeight: '22px', color: '#64748b', margin: '0 0 24px' }}>
          {businessName ? <strong>{businessName}</strong> : 'This shop'} does not have an active Pro
          subscription. Subscribe from the Shopbook POS mobile app to unlock the browser terminal on
          every device.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            justifyContent: 'center',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px',
          }}
        >
          <Smartphone size={18} color="#2563eb" />
          <span style={{ fontSize: '13px', color: '#334155' }}>
            Mobile app → <strong>Profile</strong> → <strong>Shopbook POS Pro</strong>
          </span>
        </div>

        {/* Primary Action in Card: Switch Account / Sign Out */}
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={handleLogout}
            type="button"
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#f8fafc',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fef2f2';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.borderColor = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.color = '#475569';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <LogOut size={16} />
            <span>Sign Out / Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProBlocker;
