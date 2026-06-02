'use client';

import React from 'react';
import { Eye, FileText } from 'lucide-react';

interface OrderRecord {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  discountValue: number;
  taxValue: number;
  taxRate: number;
  createdAt: number;
  dateStr: string;
  cashierName: string;
  bankName?: string;
  cardLastFour?: string;
}

interface InvoiceListTableProps {
  loading: boolean;
  filteredOrders: OrderRecord[];
  onViewReceipt: (order: OrderRecord) => void;
}

export const InvoiceListTable: React.FC<InvoiceListTableProps> = ({
  loading,
  filteredOrders,
  onViewReceipt,
}) => {
  return (
    <div style={styles.tableCard}>
      {loading ? (
        <div style={styles.emptyRow}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '12px' }}>Loading historical sales logs...</p>
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Invoice Number</th>
                <th style={styles.th}>Date & Time</th>
                <th style={styles.th}>Cashier</th>
                <th style={styles.th}>Payment Method</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Total Value</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Audit</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} style={styles.trRow} className="history-table-row">
                  <td style={styles.td}>
                    <strong>{o.invoiceNumber}</strong>
                  </td>
                  <td style={styles.td}>{o.dateStr}</td>
                  <td style={styles.td}>{o.cashierName}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                      <span style={styles.methodBadge}>
                        {o.paymentMethod.toUpperCase()}
                      </span>
                      {(o.paymentMethod === 'card' || o.paymentMethod === 'bank') && o.bankName && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '500' }}>
                          {o.bankName} {o.cardLastFour ? `(**** ${o.cardLastFour})` : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: o.status === 'voided' ? '#fff1f2' : '#f0fdf4',
                      color: o.status === 'voided' ? 'var(--error)' : 'var(--success)',
                      border: o.status === 'voided' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                    }}>
                      {o.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <strong style={{ color: o.status === 'voided' ? 'var(--muted)' : 'var(--primary)' }}>
                      Rs. {o.totalAmount.toLocaleString()}
                    </strong>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button onClick={() => onViewReceipt(o)} style={styles.viewReceiptBtn}>
                      <Eye size={14} />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} style={styles.emptyRow}>
                    <FileText size={36} color="var(--muted)" style={{ marginBottom: '8px' }} />
                    <h4>No matching transactions found</h4>
                    <p>Invoiced completed records will populate inside this list.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  tableWrapper: {
    overflowY: 'auto',
    flex: 1,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  trHead: {
    borderBottom: '2px solid var(--border)',
    backgroundColor: 'var(--background)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  th: {
    padding: '12px 16px',
    fontWeight: '700',
    color: 'var(--muted)',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  trRow: {
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '12px 16px',
    verticalAlign: 'middle',
    color: 'var(--dark)',
  },
  methodBadge: {
    fontSize: '10px',
    fontWeight: '600',
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid var(--accent-blue)',
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  viewReceiptBtn: {
    padding: '5px 10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--muted)',
    fontWeight: '500',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  emptyRow: {
    padding: '64px',
    textAlign: 'center',
    color: 'var(--muted)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '2px solid rgba(0,0,0,0.1)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
