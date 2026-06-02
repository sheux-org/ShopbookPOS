'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { useSettingsStore } from '../stores/settingsStore';
import { syncDatabase } from '../services/sync';
import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileNavbar } from '../components/layout/MobileNavbar';
import { Header } from '../components/layout/Header';
import { WifiOff } from 'lucide-react';

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
  const loadBusinessesFromDb = useBusinessStore((s) => s.loadBusinessesFromDb);

  const posMode = useSettingsStore((s) => s.posMode);
  const setPosMode = useSettingsStore((s) => s.setPosMode);
  const sidebarVisible = useSettingsStore((s) => s.sidebarVisible);
  const setSidebarVisible = useSettingsStore((s) => s.setSidebarVisible);

  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Network connection status watcher
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      handleSync(); // Auto sync when connection is restored
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // Zustand Hydration check
  useEffect(() => {
    setHydrated(useAuthStore.persist.hasHydrated());
    const unsubFinish = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return () => unsubFinish();
  }, []);

  // Initialize DB and load profiles on startup
  useEffect(() => {
    if (hydrated && isLoggedIn) {
      loadBusinessesFromDb();
    }
  }, [hydrated, isLoggedIn, loadBusinessesFromDb]);

  // Auth Guard
  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn && pathname !== '/auth') {
      router.push('/auth');
    } else if (isLoggedIn && pathname === '/auth') {
      router.push('/');
    }
  }, [hydrated, isLoggedIn, pathname, router]);

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

  // Periodic background sync every 30 seconds if online
  useEffect(() => {
    if (!hydrated || !isLoggedIn) return;

    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncDatabase();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [hydrated, isLoggedIn]);

  // Auto trigger sync on mount, login, or when changing active business
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  useEffect(() => {
    if (hydrated && isLoggedIn && activeBusiness?.id && activeBusiness.id !== '0') {
      useSettingsStore.getState().setBackupEnabled(true); // Always enable sync on session load/refresh
      handleSync();
    }
  }, [hydrated, isLoggedIn, activeBusiness?.id]);

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
          title: 'Invoice Sales Report',
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

  const renderContent = () => {
    if (!hydrated) {
      return (
        <div style={{
          backgroundColor: '#f9fafb',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <div style={{ color: '#6b7280', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>
              Initializing POS Terminal...
            </div>
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }

    if (!isLoggedIn) {
      if (pathname === '/auth') {
        return children;
      }
      return <div style={{ backgroundColor: '#f9fafb', height: '100vh' }} />;
    }

    if (pathname === '/auth') {
      return <div style={{ backgroundColor: '#f9fafb', height: '100vh' }} />;
    }

    const headerInfo = getHeaderInfo();
    const showSidebar = sidebarVisible;

    return (
      <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
        <MobileNavbar 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          syncing={syncing}
          handleSync={handleSync}
        />

        {/* Sidebar drawer overlay */}
        {sidebarOpen && (
          <div 
            className="sidebar-backdrop" 
            onClick={() => setSidebarOpen(false)} 
          />
        )}

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {showSidebar && (
            <Sidebar 
              sidebarCollapsed={sidebarCollapsed}
              toggleSidebarCollapsed={toggleSidebarCollapsed}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              syncing={syncing}
              syncSuccess={syncSuccess}
              handleSync={handleSync}
            />
          )}

          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
            <Header 
              headerInfo={headerInfo}
              pathname={pathname}
              sidebarVisible={sidebarVisible}
              setSidebarVisible={setSidebarVisible}
              posMode={posMode}
              setPosMode={setPosMode}
            />

             {/* Main workspace contents */}
            <main className="main-content">
              {!isOnline && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  borderBottom: '1px solid #fee2e2',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#991b1b',
                  fontSize: '13px',
                  fontWeight: '500',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  flexShrink: 0,
                  zIndex: 20,
                  lineHeight: '1.4'
                }}>
                  <WifiOff size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#b91c1c' }}>Network Connection Unstable / Offline:</strong> Cloud replication is paused. Transactions are stored in the local database, but please restore connection to prevent data loss or sync delays.
                  </div>
                </div>
              )}
              {children}
            </main>
          </div>
        </div>
      </div>
    );
  };

  return (
    <html lang="en">
      <head>
        <title>Shopbook Mini POS Web</title>
        <meta name="description" content="Offline-first premium web point of sale" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {renderContent()}
        </QueryClientProvider>
      </body>
    </html>
  );
}
