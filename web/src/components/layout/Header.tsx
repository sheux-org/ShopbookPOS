'use client';

import React from 'react';
import { Eye, EyeOff, HelpCircle } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from '../../hooks/useTranslation';

interface HeaderProps {
  headerInfo: { title: string; subtitle: string } | null;
  pathname: string;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  posMode: 'tablet' | 'normal';
  setPosMode: (mode: 'tablet' | 'normal') => void;
}

export const Header: React.FC<HeaderProps> = ({
  headerInfo,
  pathname,
  sidebarVisible,
  setSidebarVisible,
  posMode,
  setPosMode,
}) => {
  const { t } = useTranslation();
  if (!headerInfo) return null;

  return (
    <header className="common-header">
      <div>
        <h2 className="common-header-title">{headerInfo.title}</h2>
        <p className="common-header-subtitle">{headerInfo.subtitle}</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(pathname === '/' || pathname === '/pos') && (
          <>
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setSidebarVisible(!sidebarVisible)}
              className="hide-mobile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: '#ffffff',
                color: sidebarVisible ? 'var(--primary)' : 'var(--muted)',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
              }}
              title={sidebarVisible ? t('layout.hideSidebar') : t('layout.showSidebar')}
            >
              {sidebarVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{sidebarVisible ? t('layout.hideSidebar') : t('layout.showSidebar')}</span>
            </button>

            {/* View Mode Toggle Group */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                border: '1px solid var(--border)',
                padding: '4px',
                borderRadius: '8px',
                backgroundColor: '#f3f4f6',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() => setPosMode('tablet')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: posMode === 'tablet' ? '#ffffff' : 'transparent',
                  color: posMode === 'tablet' ? 'var(--primary)' : 'var(--muted)',
                  boxShadow: posMode === 'tablet' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {t('layout.tabletView')}
              </button>
              <button
                onClick={() => setPosMode('normal')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: posMode === 'normal' ? '#ffffff' : 'transparent',
                  color: posMode === 'normal' ? 'var(--primary)' : 'var(--muted)',
                  boxShadow: posMode === 'normal' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {t('layout.normalView')}
              </button>
            </div>
          </>
        )}

        {pathname === '/profile' && (
          <button
            onClick={() => window.dispatchEvent(new Event('open-help-modal'))}
            className="common-header-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: '#ffffff',
              color: 'var(--primary)',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease',
            }}
            title="Help & Contact Support"
          >
            <HelpCircle size={16} />
            <span>{t('profile.helpTitle')}</span>
          </button>
        )}

        {/* Global Quick Language Selector */}
        <LanguageSelector />
      </div>
    </header>
  );
};
