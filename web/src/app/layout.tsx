'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, BarChart3, Package, User, LogOut, Cloud, RefreshCw, Menu, X, Receipt, Tag, ChevronLeft, ChevronRight, Plus, Home, ShoppingCart, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { useCart } from '../stores/cartStore';
import { useSettingsStore } from '../stores/settingsStore';
import { syncDatabase } from '../services/sync';
import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  const router = useRouter();
  const pathname = usePathname();
  
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const employeeName = useAuthStore((s) => s.employeeName);
  const userRole = useAuthStore((s) => s.userRole);
  const logout = useAuthStore((s) => s.logout);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const loadBusinessesFromDb = useBusinessStore((s) => s.loadBusinessesFromDb);
  const cart = useCart((s) => s.cart);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const posMode = useSettingsStore((s) => s.posMode);
  const setPosMode = useSettingsStore((s) => s.setPosMode);
  const sidebarVisible = useSettingsStore((s) => s.sidebarVisible);
  const setSidebarVisible = useSettingsStore((s) => s.setSidebarVisible);

  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // Initialize DB and load profiles on startup
  useEffect(() => {
    if (isLoggedIn) {
      loadBusinessesFromDb();
    }
  }, [isLoggedIn, loadBusinessesFromDb]);

  // Auth Guard
  useEffect(() => {
    // Wait for hydration
    const timer = setTimeout(() => {
      if (!isLoggedIn && pathname !== '/auth') {
        router.push('/auth');
      } else if (isLoggedIn && pathname === '/auth') {
        router.push('/');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isLoggedIn, pathname, router]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncSuccess(null);
    try {
      const success = await syncDatabase();
      setSyncSuccess(success);
      setTimeout(() => setSyncSuccess(null), 2500);
    } catch {
      setSyncSuccess(false);
      setTimeout(() => setSyncSuccess(null), 2500);
    } finally {
      setSyncing(false);
    }
  };

  const navItems = [
    { name: 'POS Terminal', path: '/', icon: ShoppingCart },
    { name: 'Catalog Manager', path: '/catalog', icon: Tag },
    { name: 'Sales History', path: '/history', icon: Receipt },
    { name: 'Insights', path: '/insights', icon: BarChart3 },
    { name: 'Stocks', path: '/stocks', icon: Package },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  const getHeaderInfo = () => {
    switch (pathname) {
      case '/':
      case '/pos':
        return {
          title: 'POS Billing Terminal',
          subtitle: 'Active sales invoice billing settlement tender details',
        };
      case '/catalog':
        return {
          title: 'Catalog Management',
          subtitle: 'Configure products, prices, categories, and inventory alerts',
        };
      case '/history':
        return {
          title: 'Invoices Sales Ledger',
          subtitle: 'Audit history of past sales, print receipts, and void invoices',
        };
      case '/insights':
        return {
          title: 'Analytics Insights Dashboard',
          subtitle: 'Weekly sales graphs, order history and ledger summaries',
        };
      case '/stocks':
        return {
          title: 'Stocks & Inventory Log',
          subtitle: 'Real-time stock alerts and audit tracking ledger',
        };
      case '/profile':
        return {
          title: 'Profile Settings Dashboard',
          subtitle: 'Configure branches, staff logs, backups and terminal details',
        };
      default:
        return null;
    }
  };

  const headerInfo = getHeaderInfo();
  const showSidebar = isLoggedIn && pathname !== '/auth';

  return (
    <html lang="en">
      <head>
        <title>Shopbook Mini POS Web</title>
        <meta name="description" content="Offline-first premium web point of sale" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
          {showSidebar && (
            <>
              {/* Mobile top navigation header */}
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
                <div className="mobile-sync-dot" onClick={handleSync} title="Click to backup now">
                  <div className={`sync-dot-inner ${syncing ? 'syncing' : ''}`} />
                </div>
              </header>

              {/* Sidebar drawer overlay */}
              {sidebarOpen && (
                <div 
                  className="sidebar-backdrop" 
                  onClick={() => setSidebarOpen(false)} 
                />
              )}
            </>
          )}

          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {showSidebar && sidebarVisible && (
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
                        {item.path === '/pos' && cartItemsCount > 0 && (
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
            )}

            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
              {showSidebar && headerInfo && (
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
              )}

              {/* Main workspace contents */}
              <main className="main-content">
                {children}
              </main>
            </div>
          </div>
        </div>
        </QueryClientProvider>
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '260px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    flexShrink: 0,
  },
  brandWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '28px',
    paddingLeft: '6px',
  },
  brandLogo: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '20px',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
  },
  brandTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--dark)',
    lineHeight: '1.2',
  },
  brandSubtitle: {
    fontSize: '11px',
    color: 'var(--primary)',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  businessCard: {
    display: 'flex',
    gap: '12px',
    backgroundColor: 'var(--light-blue)',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '24px',
    alignItems: 'center',
    border: '1px solid var(--accent-blue)',
  },
  avatar: {
    width: '42px',
    height: '42px',
    borderRadius: '21px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '15px',
    flexShrink: 0,
  },
  bizName: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  employeeName: {
    fontSize: '11px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  roleBadge: {
    display: 'inline-block',
    fontSize: '9px',
    fontWeight: '800',
    backgroundColor: 'var(--accent-blue)',
    color: 'var(--primary)',
    padding: '2px 6px',
    borderRadius: '4px',
    marginTop: '6px',
    letterSpacing: '0.5px',
  },
  navMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  navBtnActive: {
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
  },
  bottomActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid var(--border)',
  },
  syncBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--success)',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#fff1f2',
    color: 'var(--error)',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};
