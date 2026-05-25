'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, BarChart3, Package, User, LogOut, Cloud, RefreshCw, Menu, X, Receipt, Tag, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { syncDatabase } from '../services/sync';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const employeeName = useAuthStore((s) => s.employeeName);
  const userRole = useAuthStore((s) => s.userRole);
  const logout = useAuthStore((s) => s.logout);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const loadBusinessesFromDb = useBusinessStore((s) => s.loadBusinessesFromDb);

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
    { name: 'POS Billing', path: '/', icon: ShoppingBag },
    { name: 'Catalog Manager', path: '/catalog', icon: Tag },
    { name: 'Sales History', path: '/history', icon: Receipt },
    { name: 'Insights', path: '/insights', icon: BarChart3 },
    { name: 'Stocks', path: '/stocks', icon: Package },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  const getHeaderInfo = () => {
    switch (pathname) {
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
            {showSidebar && (
              <aside className={`pos-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarOpen ? 'open' : ''}`}>
                {/* Brand Title */}
                <div style={styles.brandWrapper}>
                  <div style={styles.brandLogo}>S</div>
                  {!sidebarCollapsed && (
                    <div style={{ flex: 1 }}>
                      <h1 style={styles.brandTitle}>Shopbook</h1>
                      <span style={styles.brandSubtitle}>Web Mini POS Pro</span>
                    </div>
                  )}
                  <button 
                    onClick={() => setSidebarOpen(false)} 
                    className="sidebar-close-btn"
                  >
                    <X size={18} />
                  </button>
                  <button 
                    onClick={toggleSidebarCollapsed}
                    className="sidebar-collapse-toggle-btn hide-mobile"
                    style={{
                      border: 'none',
                      background: '#f3f4f6',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--muted)',
                      marginLeft: sidebarCollapsed ? '0' : 'auto',
                    }}
                    title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                  >
                    {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                  </button>
                </div>

                {/* Active Business Info Card */}
                <div 
                  style={{ 
                    ...styles.businessCard, 
                    padding: sidebarCollapsed ? '8px' : '12px',
                    justifyContent: 'center'
                  }}
                  title={`${activeBusiness?.name || 'Partner Store'} - ${employeeName}`}
                >
                  <div style={styles.avatar}>
                    {activeBusiness?.name?.substring(0, 2).toUpperCase() || 'SP'}
                  </div>
                  {!sidebarCollapsed && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={styles.bizName}>{activeBusiness?.name || 'Partner Store'}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <p style={styles.employeeName}>{employeeName}</p>
                        <span style={styles.roleBadge}>{userRole.toUpperCase()}</span>
                      </div>
                    </div>
                  )}
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
                        style={{
                          ...styles.navBtn,
                          ...(isActive ? styles.navBtnActive : {}),
                          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                          padding: sidebarCollapsed ? '12px 0' : '12px',
                        }}
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        <Icon size={18} />
                        {!sidebarCollapsed && <span>{item.name}</span>}
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
                    style={{
                      ...styles.syncBtn,
                      justifyContent: sidebarCollapsed ? 'center' : 'center',
                      padding: sidebarCollapsed ? '10px 0' : '10px',
                    }}
                    title={sidebarCollapsed ? (syncing ? 'Backing up...' : 'Backup to Cloud') : undefined}
                  >
                    <RefreshCw size={16} className={syncing ? 'spin-anim' : ''} style={{
                      animation: syncing ? 'spin 1.5s linear infinite' : 'none',
                      marginRight: sidebarCollapsed ? '0' : '8px'
                    }} />
                    {!sidebarCollapsed && (
                      <span>
                        {syncing ? 'Backing up...' : syncSuccess === true ? 'Sync Complete!' : syncSuccess === false ? 'Sync Failed' : 'Backup to Cloud'}
                      </span>
                    )}
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
                    style={{
                      ...styles.logoutBtn,
                      justifyContent: sidebarCollapsed ? 'center' : 'center',
                      padding: sidebarCollapsed ? '10px 0' : '10px',
                    }}
                    title={sidebarCollapsed ? 'Sign Out' : undefined}
                  >
                    <LogOut size={16} style={{ marginRight: sidebarCollapsed ? '0' : '8px' }} />
                    {!sidebarCollapsed && <span>Sign Out</span>}
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
