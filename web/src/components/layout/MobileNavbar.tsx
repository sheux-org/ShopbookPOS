'use client';

import React from 'react';
import { Menu } from 'lucide-react';
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
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hamburger-btn"
        aria-label="Toggle Navigation Sidebar"
      >
        <Menu size={22} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="mobile-brand-logo">S</div>
        <span className="mobile-brand-title">Shopbook</span>
      </div>
      {canPerform('read', 'sync') && (
        <div className="mobile-sync-dot" onClick={handleSync} title="Click to backup now">
          <div className={`sync-dot-inner ${syncing ? 'syncing' : ''}`} />
        </div>
      )}
    </header>
  );
};

