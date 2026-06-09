import React from 'react';
import { useSyncStore } from '../../stores/syncStore';

interface SyncBlockerProps {
  activeBusiness: any;
  syncSuccess: boolean | null;
  syncing: boolean;
  handleSync: () => Promise<void>;
}

export const SyncBlocker: React.FC<SyncBlockerProps> = ({
  activeBusiness,
  syncSuccess,
  syncing,
  handleSync,
}) => {
  // If sync failed and we have no local data, show premium error fallback
  if (syncSuccess === false && !syncing) {
    return (
      <div
        style={{
          backgroundColor: '#f8fafc',
          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(229, 231, 235, 0.6)',
            borderRadius: '16px',
            padding: '40px 32px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              animation: 'pulse 2s infinite',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '10px',
              letterSpacing: '-0.3px',
            }}
          >
            Sync Interrupted
          </h3>
          <p
            style={{
              fontSize: '13px',
              color: '#64748b',
              lineHeight: '1.6',
              marginBottom: '28px',
            }}
          >
            Failed to connect to the cloud. Please verify your internet connection or continue to
            use the terminal offline.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
            }}
          >
            <button
              onClick={handleSync}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
            >
              Retry Connection
            </button>
            <button
              onClick={() => {
                useSyncStore.getState().setHasCompletedInitialSync(true);
              }}
              style={{
                backgroundColor: 'transparent',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.color = '#1e293b';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#475569';
              }}
            >
              Continue Offline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal initial syncing loader
  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(229, 231, 235, 0.6)',
          borderRadius: '16px',
          padding: '40px 32px',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '56px',
            height: '56px',
            marginBottom: '24px',
          }}
        >
          {/* Spinner rings */}
          <div
            style={{
              position: 'absolute',
              width: '56px',
              height: '56px',
              border: '4px solid #eff6ff',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: '56px',
              height: '56px',
              border: '4px solid transparent',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite',
            }}
          />
        </div>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '8px',
            letterSpacing: '-0.3px',
          }}
        >
          {!activeBusiness || activeBusiness.id === '0'
            ? 'Loading Business Profile'
            : 'Setting Up POS Terminal'}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: '#64748b',
            lineHeight: '1.5',
          }}
        >
          {!activeBusiness || activeBusiness.id === '0'
            ? 'Please wait while we initialize your terminal...'
            : 'Downloading your products and sync settings from cloud. This will only take a moment...'}
        </p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
export default SyncBlocker;
