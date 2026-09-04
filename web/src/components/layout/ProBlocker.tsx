'use client';

import React from 'react';
import { Diamond, Smartphone } from 'lucide-react';

/**
 * Full-page gate for the web terminal, which is itself a Pro feature.
 * Purchase happens in the mobile app — deliberately no CTA to buy here.
 */
export const ProBlocker: React.FC<{ businessName?: string | null }> = ({ businessName }) => (
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
    }}
  >
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
    </div>
  </div>
);

export default ProBlocker;
