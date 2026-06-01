'use client';

import React from 'react';
import { Eye, EyeOff, Plus } from 'lucide-react';

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
  if (!headerInfo) return null;

  return (
    <header className="common-header">
      <div>
        <h2 className="common-header-title">{headerInfo.title}</h2>
        <p className="common-header-subtitle">{headerInfo.subtitle}</p>
      </div>
      
      {(pathname === '/' || pathname === '/pos') && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setSidebarVisible(!sidebarVisible)}
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
              transition: 'all 0.2s ease'
            }}
            title={sidebarVisible ? "Hide Sidebar Menu" : "Show Sidebar Menu"}
          >
            {sidebarVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}</span>
          </button>

          {/* View Mode Toggle Group */}
          <div style={{ display: 'flex', gap: '4px', border: '1px solid var(--border)', padding: '4px', borderRadius: '8px', backgroundColor: '#f3f4f6', alignItems: 'center' }}>
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
                transition: 'all 0.2s ease'
              }}
            >
              Tablet View
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
                transition: 'all 0.2s ease'
              }}
            >
              Normal View
            </button>
          </div>
        </div>
      )}

      {pathname === '/catalog' && (
        <button 
          onClick={() => window.dispatchEvent(new Event('open-register-product-modal'))}
          className="common-header-btn"
        >
          <Plus size={18} />
          <span>Register Product</span>
        </button>
      )}
    </header>
  );
};
