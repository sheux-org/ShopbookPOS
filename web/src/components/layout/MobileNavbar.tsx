'use client';

import React from 'react';
import { Menu, CloudUpload, CheckCircle2 } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from '../../hooks/useTranslation';

interface MobileNavbarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  syncing: boolean;
  handleSync: () => Promise<void>;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  syncing,
  handleSync,
}) => {
  const { canPerform } = useUserPermissions();
  const { t } = useTranslation();

  return (
    <header className="mobile-navbar">
      {/* Hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hamburger-btn"
        aria-label="Toggle Navigation Sidebar"
      >
        <Menu size={21} />
      </button>

      {/* Brand */}
      <div className="mobile-brand-group">
        {/* Shopbook Logo Mark */}
        <img src="/logo.png" alt="Shopbook Logo" className="mobile-brand-logo-image" />

        {/* Text block */}
        <div className="mobile-brand-text-block">
          <span className="mobile-brand-shopbook">Shopbook</span>
          <span className="mobile-brand-minpos">POS</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
        <LanguageSelector compact />

        {/* Sync Button */}
        {canPerform('read', 'sync') && (
          <button
            className={`mobile-sync-btn ${syncing ? 'syncing' : ''}`}
            onClick={handleSync}
            title={syncing ? t('insights.syncingBtn') : t('insights.btnSyncDatabase')}
            aria-label="Cloud sync"
          >
            {syncing ? (
              <CloudUpload size={17} className="sync-icon-spin" />
            ) : (
              <CheckCircle2 size={17} />
            )}
            <span className="mobile-sync-label">
              {syncing ? t('insights.syncingBtn') : t('insights.syncSuccessTitle')}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
