'use client';

import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useBusinessStore } from '../../stores/businessStore';
import { 
  TrendingUp, ShoppingCart, DollarSign, AlertTriangle, Eye, Sparkles, Printer
} from 'lucide-react';
import './insights.css';
import { useBusinessInsights } from '../../hooks/useInsights';

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

  // Modal receipt states
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  // React Query Hook
  const { data: insights, isLoading } = useBusinessInsights(
    activeBusiness?.id || '0',
    'all' as any,
    null,
    null
  );

  const orders = insights?.resolvedOrders || [];
  const lowStockCount = insights?.lowStockCount || 0;

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

  const receiptSubtotal = useMemo(() => {
    if (!selectedReceipt || !selectedReceipt.items) return 0;
    return selectedReceipt.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
  }, [selectedReceipt]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>
        Loading business analytics insights...
      </div>
    );
  }

  return (
    <div className="insights-container fade-in">

      <div className="insights-workspace">
        {/* Left Side: KPIs and Chart */}
        <div className="metrics-pane">
          {/* KPI grid */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                <DollarSign size={20} />
              </div>
              <div>
                <h4 className="kpi-label">GROSS REVENUE</h4>
                <p className="kpi-val">Rs. {kpiMetrics.grossRevenue.toLocaleString()}</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-box" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>
                <ShoppingCart size={20} />
              </div>
              <div>
                <h4 className="kpi-label">INVOICES COMPLETED</h4>
                <p className="kpi-val">{kpiMetrics.count}</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-box" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6' }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <h4 className="kpi-label">AVERAGE BASKET</h4>
                <p className="kpi-val">Rs. {Math.round(kpiMetrics.avgVal).toLocaleString()}</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="kpi-label">LOW STOCK ITEMS</h4>
                <p className="kpi-val">{lowStockCount}</p>
              </div>
            </div>
          </div>

          {/* SVG Sales Distribution Chart */}
          <div className="chart-card">
            <h3 className="chart-title">Weekly Revenue Distribution</h3>
            
            <div className="chart-wrapper">
              {/* Bars */}
              <div className="chart-bars-container">
                {weeklySalesData.map((data, idx) => (
                  <div key={idx} className="chart-col">
                    <div className="chart-tooltip">
                      Rs. {data.amount.toLocaleString()}
                    </div>
                    <div 
                      className="chart-bar" 
                      style={{ height: `${Math.max(4, data.percent)}%` }} 
                    />
                    <span className="chart-day-text">{data.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Ledger Transactions */}
        <div className="ledger-pane">
          <div className="ledger-header">
            <ShoppingCart size={16} color="var(--primary)" />
            <h3 className="ledger-title">Transaction Ledger</h3>
          </div>

          <div className="ledger-table-wrapper">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th style={{ textAlign: 'center' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{o.invoiceNumber}</div>
                    </td>
                    <td>{o.date}</td>
                    <td>
                      <span className="ledger-method-badge">
                        {o.paymentMethod.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                      Rs. {o.totalAmount.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => {
                          setSelectedReceipt(o);
                          setShowReceipt(true);
                        }}
                        className="ledger-view-btn"
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
              <div className="ledger-empty">
                <p>No orders invoiced yet.</p>
              </div>
            )}
            
            {/* Added spacer to ensure bottom scroll gap */}
            <div style={{ height: '80px' }} />
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
                  <span>Rs. {receiptSubtotal.toLocaleString()}</span>
                </div>
                {selectedReceipt.discountValue > 0 && (
                  <div style={styles.receiptTotalsRow}>
                    <span>Discount</span>
                    <span>- Rs. {selectedReceipt.discountValue.toLocaleString()}</span>
                  </div>
                )}
                <div style={styles.receiptTotalsRow}>
                  <span>VAT Tax (8%)</span>
                  <span>Rs. {selectedReceipt.taxValue.toLocaleString()}</span>
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
                  const printContents = document.getElementById('printable-receipt-view')?.innerHTML;
                  const originalContents = document.body.innerHTML;
                  if (printContents) {
                    document.body.innerHTML = printContents;
                    window.print();
                    document.body.innerHTML = originalContents;
                    window.location.reload(); // Refresh to restore JS binders
                  }
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
