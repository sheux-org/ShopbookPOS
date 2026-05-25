'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import database from '../../db/database';
import { Q } from '@nozbe/watermelondb';
import { 
  TrendingUp, ShoppingCart, DollarSign, AlertTriangle, 
  FileText, Download, Calendar, ArrowRight, Eye, Sparkles, X, Printer
} from 'lucide-react';

interface OrderRecord {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: string;
  discountValue: number;
  taxValue: number;
  date: string;
  timestamp: number;
  items: any[];
}

export default function InsightsPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const employeeName = useAuthStore((s) => s.employeeName);

  // States
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Modal receipt states
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  // Load orders and count low stock items
  const loadInsightsData = async () => {
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

      // 1. Fetch Orders
      let ordersList: any[] = [];
      if (matchedBizId) {
        ordersList = await database.get('orders').query(Q.where('business_id', matchedBizId)).fetch();
      } else {
        ordersList = await database.get('orders').query().fetch();
      }

      const mappedOrders: OrderRecord[] = [];
      for (const ord of ordersList) {
        // Fetch order items
        const dbItems = await database.get('order_items').query(Q.where('order_id', ord.id)).fetch();
        
        mappedOrders.push({
          id: ord.id,
          invoiceNumber: ord.invoiceNumber,
          totalAmount: ord.totalAmount,
          paymentMethod: ord.paymentMethod || 'cash',
          discountValue: ord.discountValue || 0,
          taxValue: ord.taxValue || 0,
          timestamp: ord.createdAt,
          date: new Date(ord.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          items: dbItems.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          }))
        });
      }

      // Sort orders by timestamp newest first
      setOrders(mappedOrders.sort((a, b) => b.timestamp - a.timestamp));

      // 2. Count low stock items
      let productsList: any[] = [];
      if (matchedBizId) {
        productsList = await database.get('products').query(Q.where('business_id', matchedBizId)).fetch();
      } else {
        productsList = await database.get('products').query().fetch();
      }

      const lowCount = productsList.filter((p: any) => {
        return p.lowStockAlert && p.stockCount <= p.lowStockAlert && p.stockCount > 0;
      }).length;
      setLowStockCount(lowCount);

    } catch (err) {
      console.error('Failed to load insights data:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadInsightsData();
    }
  }, [isLoggedIn, activeBusiness]);

  // Aggregate KPI metrics
  const kpiMetrics = useMemo(() => {
    const grossRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const count = orders.length;
    const avgVal = count > 0 ? grossRevenue / count : 0;
    return {
      grossRevenue,
      count,
      avgVal
    };
  }, [orders]);

  // Aggregate weekly daily sales for SVG Chart
  // Returns array of 7 items corresponding to Monday-Sunday
  const weeklySalesData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const salesMap = new Map<string, number>();
    days.forEach(d => salesMap.set(d, 0));

    // Filter orders within the last 7 days
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentOrders = orders.filter(o => o.timestamp >= oneWeekAgo);

    recentOrders.forEach(o => {
      const dayName = days[new Date(o.timestamp).getDay()];
      salesMap.set(dayName, (salesMap.get(dayName) || 0) + o.totalAmount);
    });

    const maxAmt = Math.max(...Array.from(salesMap.values()), 1000); // Avoid divide-by-zero, min scale 1000

    return days.map(d => ({
      day: d,
      amount: salesMap.get(d) || 0,
      percent: ((salesMap.get(d) || 0) / maxAmt) * 100
    }));
  }, [orders]);

  return (
    <div style={styles.container} className="fade-in">
      {/* Header bar */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.headerTitle}>Analytics Insights Dashboard</h2>
          <p style={styles.headerSubtitle}>Weekly sales graphs, order history and ledger summaries</p>
        </div>
      </div>

      <div style={styles.workspace}>
        {/* Left Side: KPIs and Chart */}
        <div style={styles.metricsPane}>
          {/* KPI grid */}
          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={{ ...styles.kpiIconBox, backgroundColor: '#EFF6FF', color: 'var(--primary)' }}>
                <DollarSign size={20} />
              </div>
              <div>
                <h4 style={styles.kpiLabel}>GROSS REVENUE</h4>
                <p style={styles.kpiVal}>Rs. {kpiMetrics.grossRevenue.toLocaleString()}</p>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={{ ...styles.kpiIconBox, backgroundColor: '#EFF6FF', color: 'var(--primary)' }}>
                <ShoppingCart size={20} />
              </div>
              <div>
                <h4 style={styles.kpiLabel}>INVOICES COMPLETED</h4>
                <p style={styles.kpiVal}>{kpiMetrics.count}</p>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={{ ...styles.kpiIconBox, backgroundColor: '#EFF6FF', color: 'var(--primary)' }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <h4 style={styles.kpiLabel}>AVERAGE BASKET</h4>
                <p style={styles.kpiVal}>Rs. {Math.round(kpiMetrics.avgVal).toLocaleString()}</p>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={{ ...styles.kpiIconBox, backgroundColor: '#FFF1F2', color: 'var(--error)' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 style={styles.kpiLabel}>LOW STOCK ITEMS</h4>
                <p style={styles.kpiVal}>{lowStockCount}</p>
              </div>
            </div>
          </div>

          {/* SVG Sales Distribution Chart */}
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Weekly Revenue Distribution</h3>
            
            <div style={styles.chartWrapper}>
              {/* Bars */}
              <div style={styles.chartBarsContainer}>
                {weeklySalesData.map((data, idx) => (
                  <div key={idx} style={styles.chartCol}>
                    <div style={styles.chartTooltip}>
                      Rs. {data.amount.toLocaleString()}
                    </div>
                    <div style={{
                      ...styles.chartBar,
                      height: `${Math.max(4, data.percent)}%`
                    }} />
                    <span style={styles.chartDayText}>{data.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Ledger Transactions */}
        <div style={styles.ledgerPane}>
          <div style={styles.ledgerHeader}>
            <ShoppingCart size={16} color="var(--primary)" />
            <h3 style={styles.ledgerTitle}>Transaction Ledger</h3>
          </div>

          <div style={styles.ledgerTableWrapper}>
            <table style={styles.ledgerTable}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Invoice</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Method</th>
                  <th style={styles.th}>Amount</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 'bold' }}>{o.invoiceNumber}</div>
                    </td>
                    <td style={styles.td}>{o.date}</td>
                    <td style={styles.td}>
                      <span style={styles.methodBadge}>
                        {o.paymentMethod.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: 'var(--primary)' }}>
                      Rs. {o.totalAmount.toLocaleString()}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button 
                        onClick={() => {
                          setSelectedReceipt(o);
                          setShowReceipt(true);
                        }}
                        style={styles.viewReceiptBtn}
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {orders.length === 0 && (
              <div style={styles.emptyLedgerState}>
                <p>No orders invoiced yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Completed Invoice Receipt Printable Modal */}
      {showReceipt && selectedReceipt && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '420px', padding: '0px' }}>
            <div style={styles.receiptContainer} id="printable-receipt-view">
              <div style={styles.receiptHeader}>
                <span style={styles.receiptSparkle}><Sparkles size={16} /></span>
                <h3 style={styles.receiptStoreName}>{activeBusiness?.name || 'Shopbook POS Partner'}</h3>
                <p style={styles.receiptStoreAddress}>{activeBusiness?.address || 'Sri Lanka'}</p>
                <p style={styles.receiptStorePhone}>{activeBusiness?.phone || '+94 ** *** ****'}</p>
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptMeta}>
                <div><strong>Invoice:</strong> {selectedReceipt.invoiceNumber}</div>
                <div><strong>Date:</strong> {selectedReceipt.date}</div>
                <div><strong>Cashier:</strong> {employeeName}</div>
              </div>

              <div style={styles.receiptDivider} />

              {/* Items List */}
              <div style={styles.receiptItemsList}>
                <div style={{ ...styles.receiptItemRow, fontWeight: 'bold' }}>
                  <span style={{ flex: 2 }}>Item</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>Qty</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
                </div>
                {selectedReceipt.items.map((item: any, idx: number) => (
                  <div key={idx} style={styles.receiptItemRow}>
                    <span style={{ flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>{item.quantity}</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={styles.receiptDivider} />

              {/* Totals */}
              <div style={styles.receiptTotals}>
                <div style={styles.receiptTotalsRow}>
                  <span>Subtotal</span>
                  <span>Rs. {selectedReceipt.subtotal.toLocaleString()}</span>
                </div>
                {selectedReceipt.discountAmount > 0 && (
                  <div style={styles.receiptTotalsRow}>
                    <span>Discount</span>
                    <span>- Rs. {selectedReceipt.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div style={styles.receiptTotalsRow}>
                  <span>VAT Tax (8%)</span>
                  <span>Rs. {selectedReceipt.taxAmount.toLocaleString()}</span>
                </div>
                <div style={{ ...styles.receiptTotalsRow, fontWeight: 'bold', fontSize: '15px', marginTop: '6px' }}>
                  <span>Total Amount</span>
                  <span>Rs. {selectedReceipt.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div style={styles.receiptDivider} />

              <div style={styles.receiptFooter}>
                <p>Method: {selectedReceipt.paymentMethod.toUpperCase()}</p>
                <p style={{ marginTop: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>THANK YOU FOR YOUR VISIT! 🇱🇰</p>
                <p style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '4px' }}>Powered by Shopbook Mini POS Pro</p>
              </div>
            </div>

            {/* Receipt actions footer */}
            <div style={styles.receiptActions}>
              <button 
                onClick={() => {
                  window.print();
                }}
                style={styles.printBtn}
              >
                <Printer size={16} />
                <span>Print receipt (PDF)</span>
              </button>
              <button 
                onClick={() => setShowReceipt(false)}
                style={styles.receiptDoneBtn}
              >
                Close Receipt
              </button>
            </div>
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
  metricsPane: {
    flex: 5,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    borderRight: '1px solid var(--border)',
    overflowY: 'auto',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: 'var(--shadow)',
  },
  kpiIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: '10px',
    fontWeight: '800',
    color: 'var(--muted)',
    letterSpacing: '0.5px',
  },
  kpiVal: {
    fontSize: '20px',
    fontWeight: '800',
    color: 'var(--dark)',
    marginTop: '4px',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '24px',
    boxShadow: 'var(--shadow-lg)',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '280px',
  },
  chartTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: 'var(--dark)',
    marginBottom: '28px',
  },
  chartWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
  },
  chartBarsContainer: {
    display: 'flex',
    width: '100%',
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: '20px',
  },
  chartCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    height: '100%',
    justifyContent: 'flex-end',
    cursor: 'pointer',
  },
  chartBar: {
    width: '32px',
    backgroundColor: 'var(--primary)',
    borderRadius: '6px 6px 0 0',
    transition: 'all 0.3s ease',
  },
  chartDayText: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--muted)',
    marginTop: '10px',
  },
  chartTooltip: {
    position: 'absolute',
    bottom: '105%',
    backgroundColor: 'var(--dark)',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: 'bold',
    padding: '4px 8px',
    borderRadius: '4px',
    opacity: 0,
    transform: 'translateY(4px)',
    transition: 'all 0.2s ease',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  ledgerPane: {
    flex: 5,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  ledgerHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  ledgerTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: 'var(--dark)',
  },
  ledgerTableWrapper: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px',
  },
  ledgerTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  thRow: {
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 'bold',
    color: 'var(--muted)',
    fontSize: '10px',
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
  methodBadge: {
    fontSize: '9px',
    fontWeight: '800',
    backgroundColor: '#f3f4f6',
    color: 'var(--muted)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  viewReceiptBtn: {
    padding: '4px 10px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontWeight: 'bold',
    fontSize: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
  emptyLedgerState: {
    padding: '48px 24px',
    textAlign: 'center',
    color: 'var(--muted)',
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
  receiptContainer: {
    padding: '32px 24px',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  receiptHeader: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  receiptSparkle: {
    color: 'var(--yellow)',
  },
  receiptStoreName: {
    fontSize: '16px',
    fontWeight: 'bold',
    fontFamily: 'var(--font-sans)',
  },
  receiptStoreAddress: {
    color: 'var(--muted)',
  },
  receiptStorePhone: {
    color: 'var(--muted)',
  },
  receiptDivider: {
    borderTop: '1px dashed #d1d5db',
    margin: '16px 0',
  },
  receiptMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  receiptItemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  receiptItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  receiptTotalsRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  receiptFooter: {
    textAlign: 'center',
    marginTop: '16px',
  },
  receiptActions: {
    padding: '20px 24px',
    backgroundColor: 'var(--background)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  printBtn: {
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
  receiptDoneBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--dark)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
  },
};
