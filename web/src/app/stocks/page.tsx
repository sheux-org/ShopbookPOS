'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { Package, History, CheckCircle } from 'lucide-react';
import './stocks.css';

import { StocksTable } from '../../components/stocks/StocksTable';
import { AuditLogScroller } from '../../components/stocks/AuditLogScroller';
import { AdjustStockModal } from '../../components/stocks/AdjustStockModal';

interface DBProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  stockCount: number;
  lowStockAlert?: number;
  unitType?: string;
  costPrice?: number;
  quickCode?: string;
  barcode?: string;
}

interface DBInventoryLog {
  id: string;
  productName: string;
  productIcon: string;
  type: 'in' | 'out';
  quantity: number;
  reason?: string;
  date: string;
}

export default function StocksPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);

  // States
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [logs, setLogs] = useState<DBInventoryLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'audit'>('inventory');

  // Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<DBProduct | null>(null);

  // Load products and logs from IndexedDB
  const loadData = async () => {
    if (typeof window === 'undefined') return;
    try {
      const activeBiz = useBusinessStore.getState().activeBusiness;
      let matchedBizId = '';
      if (activeBiz && activeBiz.id !== '0') {
        const matchedBiz = await database.get('businesses').query(Q.where('name', activeBiz.name)).fetch();
        if (matchedBiz.length > 0) {
          matchedBizId = matchedBiz[0].id;
        }
      }

      // Fetch products
      let prodList: any[] = [];
      if (matchedBizId) {
        prodList = await database.get('products').query(Q.where('business_id', matchedBizId)).fetch();
      } else {
        prodList = await database.get('products').query().fetch();
      }

      const mappedProducts = prodList.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category || '',
        icon: p.icon || '📦',
        stockCount: p.stockCount || 0,
        lowStockAlert: p.lowStockAlert,
        unitType: p.unitType,
        costPrice: p.costPrice,
        quickCode: p.quickCode,
        barcode: p.barcode,
      }));
      setProducts(mappedProducts);

      // Fetch inventory logs (all or mapped to business products)
      const allLogs = await database.get('inventory_logs').query().fetch();
      const productMap = new Map<string, DBProduct>();
      mappedProducts.forEach(p => productMap.set(p.id, p));

      const mappedLogs: DBInventoryLog[] = [];
      for (const logItem of allLogs) {
        const log = logItem as any;
        const prod = await log.product.fetch();
        if (prod && (matchedBizId === '' || prod.business.id === matchedBizId)) {
          mappedLogs.push({
            id: log.id,
            productName: prod.name,
            productIcon: prod.icon || '📦',
            type: log.type,
            quantity: log.quantity,
            reason: log.reason,
            date: new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          });
        }
      }

      // Sort logs newest first
      setLogs(mappedLogs.sort((a, b) => b.id.localeCompare(a.id)));

    } catch (err) {
      console.error('Failed to load inventory data:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn, activeBusiness]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1500);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const query = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        (p.quickCode && p.quickCode.includes(query)) ||
        (p.barcode && p.barcode.includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query))
      );
    });
  }, [products, searchQuery]);

  const handleAdjustSubmit = async (adjustType: 'in' | 'out', qtyNum: number, adjustReason: string) => {
    if (!selectedProduct) return;

    try {
      await database.write(async () => {
        const directProd = await database.get('products').find(selectedProduct.id) as any;
        const currentCount = directProd.stockCount || 0;
        const newCount = adjustType === 'in' ? currentCount + qtyNum : Math.max(0, currentCount - qtyNum);
        
        await directProd.update((p: any) => {
          p.stockCount = newCount;
        });

        await database.get('inventory_logs').create((log: any) => {
          log.product.set(directProd);
          log.type = adjustType;
          log.quantity = qtyNum;
          log.reason = adjustReason;
        });
      });

      triggerToast(`Successfully logged ${adjustType.toUpperCase()} adjustment! 📈`);
      loadData();
    } catch (err) {
      console.error('Failed to adjust inventory:', err);
      throw err;
    }
  };

  return (
    <div style={styles.container} className="fade-in">
      {/* Toast notification */}
      {toastMsg && (
        <div style={styles.toast}>
          <CheckCircle size={16} color="#ffffff" style={{ marginRight: '6px' }} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Segmented tab navigation shown only on mobile/tablet viewports (< 1024px) */}
      <div className="stocks-tab-bar">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`stocks-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
        >
          <Package size={16} />
          <span>Product Inventory</span>
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`stocks-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
        >
          <History size={16} />
          <span>Recent Audit Log</span>
        </button>
      </div>

      <div style={styles.workspace} className="stocks-workspace">
        <StocksTable 
          filteredProducts={filteredProducts}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onAdjustStock={(p) => {
            setSelectedProduct(p);
            setShowAdjustModal(true);
          }}
          activeTab={activeTab}
        />

        <AuditLogScroller 
          logs={logs}
          activeTab={activeTab}
        />
      </div>

      <AdjustStockModal 
        isOpen={showAdjustModal}
        product={selectedProduct}
        onClose={() => {
          setShowAdjustModal(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleAdjustSubmit}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--success)',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '30px',
    fontWeight: 'bold',
    fontSize: '13px',
    zIndex: 99999,
    boxShadow: '0 10px 20px rgba(22, 163, 74, 0.25)',
  },
  workspace: {
    display: 'flex',
    flex: 1,
    height: '100%',
    overflow: 'hidden',
  },
};
