'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  children: React.ReactNode;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  icon,
  footer,
  maxWidth = '540px',
  children,
}) => {
  // Lock body scroll and listen for Escape key when drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose} aria-modal="true" role="dialog">
      <div
        style={{
          ...styles.drawerContainer,
          maxWidth,
        }}
        className="slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            {icon && <div style={styles.iconBox}>{icon}</div>}
            <div style={styles.headerTitles}>
              <div style={styles.titleRow}>
                <h3 style={styles.title}>{title}</h3>
                {badge}
              </div>
              {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeBtn}
            aria-label="Close Drawer"
            className="drawer-close-btn"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable Body with Isolated Scroll Context */}
        <div style={styles.body} className="drawer-scrollable-body">
          {children}
        </div>

        {/* Fixed Action Footer */}
        {footer && <footer style={styles.footer}>{footer}</footer>}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 9999,
    animation: 'drawerFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  },
  drawerContainer: {
    width: '100%',
    height: '100vh',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    animation: 'drawerSlideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    borderLeft: '1px solid var(--border)',
    borderTopLeftRadius: '20px',
    borderBottomLeftRadius: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    flexShrink: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
    flex: 1,
  },
  iconBox: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--primary)',
    flexShrink: 0,
  },
  headerTitles: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--dark)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--muted)',
    lineHeight: '1.4',
  },
  closeBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
    marginLeft: '12px',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexShrink: 0,
    zIndex: 10,
    boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.02)',
  },
};
