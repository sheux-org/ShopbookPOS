'use client';

import React from 'react';
import { Menu, CloudUpload, CheckCircle2 } from 'lucide-react';
import { useUserPermissions } from '../../hooks/useUserPermissions';

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

      {/* Sync Button */}
      {canPerform('read', 'sync') && (
        <button
          className={`mobile-sync-btn ${syncing ? 'syncing' : ''}`}
          onClick={handleSync}
          title={syncing ? 'Syncing to cloud...' : 'Tap to sync now'}
          aria-label="Cloud sync"
        >
          {syncing ? (
            <CloudUpload size={17} className="sync-icon-spin" />
          ) : (
            <CheckCircle2 size={17} />
          )}
          <span className="mobile-sync-label">{syncing ? 'Syncing...' : 'Synced'}</span>
        </button>
      )}
    </header>
  );
};
