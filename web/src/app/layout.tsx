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
            </>
          )}

          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {showSidebar && sidebarVisible && (
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
