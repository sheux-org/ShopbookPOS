'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  ShoppingBag, BarChart3, Package, User, LogOut, 
  RefreshCw, X, ChevronLeft, ChevronRight, ShoppingCart, Tag, Receipt, History
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { useCart } from '../../stores/cartStore';

interface SidebarProps {
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  syncing: boolean;
  syncSuccess: boolean | null;
  handleSync: () => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarCollapsed,
  toggleSidebarCollapsed,
  sidebarOpen,
  setSidebarOpen,
  syncing,
  syncSuccess,
  handleSync,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const employeeName = useAuthStore((s) => s.employeeName);
  const userRole = useAuthStore((s) => s.userRole);
  const logout = useAuthStore((s) => s.logout);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const cart = useCart((s) => s.cart);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const navItems = [
    { name: 'POS Terminal', path: '/', icon: ShoppingCart },
    { name: 'Catalog Manager', path: '/catalog', icon: Tag },
    { name: 'Sales History', path: '/history', icon: History },
    { name: 'Insights', path: '/insights', icon: BarChart3 },
    { name: 'Stocks', path: '/stocks', icon: Package },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <aside className={`pos-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarOpen ? 'open' : ''}`}>
      {/* Floating SaaS Edge Toggle Button (desktop only) */}
      <button 
        onClick={toggleSidebarCollapsed}
        className="sidebar-collapse-edge-btn hide-mobile"
        title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Unified Store & Profile Header */}
      <div className="sidebar-header-profile" title={`${activeBusiness?.name || 'Partner Store'} - ${employeeName}`}>
        <div className="sidebar-store-avatar">
          {activeBusiness?.logoUri ? (
            <img 
              src={activeBusiness.logoUri} 
              alt="Store Logo" 
              className="sidebar-store-logo-img" 
            />
          ) : (
            activeBusiness?.name?.substring(0, 2).toUpperCase() || 'SP'
          )}
        </div>
        <div className="sidebar-store-meta">
          <h3 className="sidebar-store-name">{activeBusiness?.name || 'Partner Store'}</h3>
          <div className="sidebar-employee-row">
            <span className="sidebar-employee-name">{employeeName}</span>
            <span className="sidebar-role-badge">{userRole.toUpperCase()}</span>
          </div>
        </div>
        {/* Close button for mobile screen drawer */}
        <button 
          onClick={() => setSidebarOpen(false)} 
          className="sidebar-close-btn"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Menu */}
      <nav style={styles.navMenu}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <button
              key={item.name}
              onClick={() => {
                router.push(item.path);
                setSidebarOpen(false);
              }}
              className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
              title={sidebarCollapsed ? item.name : undefined}
            >
              <span className="nav-icon"><Icon size={18} /></span>
              <span className="nav-label">{item.name}</span>
              {item.path === '/' && cartItemsCount > 0 && (
                <span className="cart-badge">
                  {cartItemsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Action Buttons */}
      <div style={styles.bottomActions}>
        {/* Cloud Sync Status */}
        <button 
          onClick={handleSync} 
          disabled={syncing}
          className="sidebar-sync-btn"
          title={sidebarCollapsed ? (syncing ? 'Backing up...' : 'Backup to Cloud') : undefined}
        >
          <span className="btn-icon">
            <RefreshCw size={16} className={syncing ? 'spin-anim' : ''} style={{
              animation: syncing ? 'spin 1.5s linear infinite' : 'none'
            }} />
          </span>
          <span className="btn-label">
            {syncing ? 'Backing up...' : syncSuccess === true ? 'Sync Complete!' : syncSuccess === false ? 'Sync Failed' : 'Backup to Cloud'}
          </span>
        </button>
        <style jsx global>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* Log out */}
        <button
          onClick={() => {
            if (confirm('Are you sure you want to sign out?')) {
              logout();
              router.push('/auth');
            }
          }}
          className="sidebar-logout-btn"
          title={sidebarCollapsed ? 'Sign Out' : undefined}
        >
          <span className="btn-icon"><LogOut size={16} /></span>
          <span className="btn-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  navMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  bottomActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid var(--border)',
  },
};
