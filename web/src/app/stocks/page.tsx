'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { 
  Package, Search, Plus, Minus, AlertTriangle, 
  History, ArrowUpRight, ArrowDownLeft, X, Save
} from 'lucide-react';

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

  // Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<DBProduct | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');
  const [adjustQty, setAdjustQty] = useState('10');
  const [adjustReason, setAdjustReason] = useState('Restock Inventory');
  const [adjusting, setAdjusting] = useState(false);

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

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !adjustQty) return;
    setAdjusting(true);

    try {
      const qtyNum = parseFloat(adjustQty);
      await database.write(async () => {
        // 1. Fetch direct product record
        const directProd = await database.get('products').find(selectedProduct.id) as any;
        const currentCount = directProd.stockCount || 0;
        const newCount = adjustType === 'in' ? currentCount + qtyNum : Math.max(0, currentCount - qtyNum);
        
        await directProd.update((p: any) => {
          p.stockCount = newCount;
        });

        // 2. Create Log record
        await database.get('inventory_logs').create((log: any) => {
          log.product.set(directProd);
          log.type = adjustType;
          log.quantity = qtyNum;
          log.reason = adjustReason;
        });
      });

      triggerToast(`Successfully logged ${adjustType.toUpperCase()} adjustment! 📈`);
      setShowAdjustModal(false);
      setSelectedProduct(null);
      setAdjustQty('10');
      setAdjustReason('Restock Inventory');
      loadData();
    } catch (err) {
      console.error('Failed to adjust inventory:', err);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div style={styles.container} className="fade-in">
      {/* Toast notification */}
      {toastMsg && (
        <div style={styles.toast}>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header bar */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.headerTitle}>Stocks & Inventory Log</h2>
          <p style={styles.headerSubtitle}>Real-time stock alerts and audit tracking ledger</p>
        </div>
      </div>

      <div style={styles.workspace}>
        {/* Left Side: Search & Table list */}
        <div style={styles.tablePane}>
          {/* Query bar */}
          <div style={styles.queryBar}>
            <div style={styles.searchBox}>
              <Search size={16} color="var(--muted)" />
              <input
                type="text"
                placeholder="Search products by name, category, barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </div>
          </div>

          {/* Table Container */}
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={{ ...styles.th, width: '40px' }} />
                  <th style={styles.th}>Product Details</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Quick Code</th>
                  <th style={styles.th}>Retail Price</th>
                  <th style={styles.th}>Cost Price</th>
                  <th style={styles.th}>Current Stock</th>
                  <th style={styles.th}>Alert Level</th>
                  <th style={{ ...styles.th, width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isOut = p.stockCount <= 0;
                  const isLow = p.lowStockAlert && p.stockCount <= p.lowStockAlert;
                  return (
                    <tr key={p.id} style={styles.tr}>
                      <td style={styles.td}>
                        {p.icon.startsWith('http') ? (
                          <img src={p.icon} alt={p.name} style={styles.prodImg} />
                        ) : (
                          <span style={styles.prodEmoji}>{p.icon}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 'bold', color: 'var(--dark)' }}>{p.name}</div>
                        {p.barcode && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>Barcode: {p.barcode}</div>}
                      </td>
                      <td style={styles.td}>{p.category}</td>
                      <td style={styles.td}>{p.quickCode ? `#${p.quickCode}` : '-'}</td>
                      <td style={styles.td}>Rs. {p.price.toLocaleString()}</td>
                      <td style={styles.td}>Rs. {p.costPrice ? p.costPrice.toLocaleString() : '0'}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.stockIndicator,
                          backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FFEDD5' : '#DCFCE7',
                          color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D',
                        }}>
                          {p.stockCount} {p.unitType || 'Units'}
                        </span>
                      </td>
                      <td style={styles.td}>{p.lowStockAlert ? `${p.lowStockAlert} Units` : '-'}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button 
                          onClick={() => {
                            setSelectedProduct(p);
                            setShowAdjustModal(true);
                          }}
                          style={styles.adjustRowBtn}
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredProducts.length === 0 && (
              <div style={styles.emptyTableState}>
                <Package size={36} color="var(--muted)" />
                <p>No inventory matching query</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Audit log */}
        <div style={styles.logPane}>
          <div style={styles.logHeader}>
            <History size={16} color="var(--primary)" />
            <h3 style={styles.logTitle}>Recent Audit Log</h3>
          </div>
          
          <div style={styles.logScroller}>
            {logs.map((log) => {
              const isIn = log.type === 'in';
              return (
                <div key={log.id} style={styles.logCard}>
                  <div style={styles.logCardTop}>
                    <span style={styles.logCardEmoji}>{log.productIcon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={styles.logCardName}>{log.productName}</h4>
                      <p style={styles.logCardDate}>{log.date}</p>
                    </div>

                    <div style={{
                      ...styles.logCardTypeBadge,
                      backgroundColor: isIn ? '#DCFCE7' : '#FEE2E2',
                      color: isIn ? '#16A34A' : '#DC2626',
                    }}>
                      {isIn ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                      <span>{isIn ? '+' : '-'}{log.quantity}</span>
                    </div>
                  </div>
                  {log.reason && (
                    <p style={styles.logCardReason}>Reason: {log.reason}</p>
                  )}
                </div>
              );
            })}

            {logs.length === 0 && (
              <div style={styles.emptyLogState}>
                <p>No inventory adjustments logged yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedProduct && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Inventory Audit Adjustment</h3>
              <button 
                onClick={() => {
                  setShowAdjustModal(false);
                  setSelectedProduct(null);
                }} 
                style={styles.modalCloseBtn}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} style={styles.modalBody}>
              <div style={styles.modalProductHeader}>
                <span style={{ fontSize: '32px' }}>{selectedProduct.icon}</span>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 'bold' }}>{selectedProduct.name}</h4>
                  <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    Current Count: {selectedProduct.stockCount} {selectedProduct.unitType || 'Units'}
                  </p>
                </div>
              </div>

              {/* Adjust type */}
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Adjustment Type</label>
                <div style={styles.adjustTypeToggle}>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('in');
                      setAdjustReason('Restock Inventory');
                    }}
                    style={{
                      ...styles.toggleBtn,
                      ...(adjustType === 'in' ? styles.toggleBtnInActive : {}),
                    }}
                  >
                    <span>Receive / Add Stock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('out');
                      setAdjustReason('Damaged Items');
                    }}
                    style={{
                      ...styles.toggleBtn,
                      ...(adjustType === 'out' ? styles.toggleBtnOutActive : {}),
                    }}
                  >
                    <span>Deduct / Write Out</span>
                  </button>
                </div>
              </div>

              {/* Qty */}
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Change Quantity</label>
                <input 
                  type="number" 
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required
                  style={styles.modalInput}
                />
              </div>

              {/* Reason */}
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Adjustment Reason</label>
                <select 
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={styles.select}
                >
                  {adjustType === 'in' ? (
                    <>
                      <option value="Restock Inventory">Restock Inventory</option>
                      <option value="Returned Items">Returned Items</option>
                      <option value="Stock Audit Adjust">Stock Audit Adjust</option>
                    </>
                  ) : (
                    <>
                      <option value="Damaged Items">Damaged Items</option>
                      <option value="Theft or Loss">Theft or Loss</option>
                      <option value="Stock Audit Adjust">Stock Audit Adjust</option>
                      <option value="Expired Items">Expired Items</option>
                    </>
                  )}
                </select>
              </div>

              <button 
                type="submit" 
                disabled={adjusting || !adjustQty}
                style={styles.modalSubmitBtn}
              >
                <Save size={16} />
                <span>{adjusting ? 'Saving adjustments...' : 'Save Audit Adjust'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
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
  header: {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  headerSubtitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  workspace: {
    display: 'flex',
    flex: 1,
    height: '100%',
    overflow: 'hidden',
  },
  tablePane: {
    flex: 7,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    overflow: 'hidden',
    borderRight: '1px solid var(--border)',
  },
  queryBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    boxShadow: 'var(--shadow)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: 'var(--dark)',
  },
  tableWrapper: {
    flex: 1,
    overflowY: 'auto',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    marginBottom: '24px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  thRow: {
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 'bold',
    color: 'var(--muted)',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '12px 16px',
    verticalAlign: 'middle',
  },
  prodImg: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    objectFit: 'cover',
  },
  prodEmoji: {
    fontSize: '24px',
  },
  stockIndicator: {
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  adjustRowBtn: {
    padding: '6px 12px',
    borderRadius: '12px',
    border: '1px solid var(--accent-blue)',
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '11px',
    cursor: 'pointer',
  },
  emptyTableState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center',
    gap: '8px',
    color: 'var(--muted)',
  },
  logPane: {
    flex: 3,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  logHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  logTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  logScroller: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  logCard: {
    backgroundColor: 'var(--background)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    padding: '12px',
  },
  logCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logCardEmoji: {
    fontSize: '24px',
  },
  logCardName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  logCardDate: {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  logCardTypeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  logCardReason: {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '6px',
    paddingLeft: '34px',
  },
  emptyLogState: {
    padding: '36px 12px',
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '12px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
  },
  modalContent: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalProductHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'var(--light-blue)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--accent-blue)',
  },
  modalInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modalLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
  },
  adjustTypeToggle: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  toggleBtn: {
    padding: '10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--muted)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  toggleBtnInActive: {
    borderColor: 'var(--success)',
    backgroundColor: '#effaf3',
    color: 'var(--success)',
  },
  toggleBtnOutActive: {
    borderColor: 'var(--error)',
    backgroundColor: '#fff1f2',
    color: 'var(--error)',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
    cursor: 'pointer',
  },
  modalSubmitBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
};
