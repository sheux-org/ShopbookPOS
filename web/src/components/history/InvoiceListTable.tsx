'use client';

import React, { useRef } from 'react';
import {
  Eye,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

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
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  totalCount: number;
  totalPages: number;
}

export const InvoiceListTable: React.FC<InvoiceListTableProps> = ({
  loading,
  filteredOrders,
  onViewReceipt,
  page,
  pageSize,
  setPage,
  setPageSize,
  totalCount,
  totalPages,
}) => {
  const { t } = useTranslation();
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div style={styles.tableCard}>
      {loading ? (
        <div style={styles.emptyContainer}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#6B7280' }}>
            {t('common.loading')}
          </p>
        </div>
      ) : (
        <div ref={tableWrapperRef} style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={{ ...styles.th, width: '280px' }}>{t('history.tableInvoice')}</th>
                <th style={{ ...styles.th, width: '160px' }}>{t('history.tableDate')}</th>
                <th style={{ ...styles.th, width: '140px' }}>{t('history.tableCashier')}</th>
                <th style={{ ...styles.th, width: '190px' }}>{t('history.tablePayment')}</th>
                <th style={{ ...styles.th, width: '100px' }}>{t('common.status')}</th>
                <th style={{ ...styles.th, width: '140px' }}>{t('history.tableTotal')}</th>
                <th style={{ ...styles.th, width: '140px', textAlign: 'right' }}>
                  {t('history.tableActions')}
                </th>
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
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span style={styles.methodBadge}>{o.paymentMethod.toUpperCase()}</span>
                      {(o.paymentMethod === 'card' || o.paymentMethod === 'bank') && o.bankName && (
                        <span
                          style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '500' }}
                        >
                          {o.bankName} {o.cardLastFour ? `(**** ${o.cardLastFour})` : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: o.status === 'voided' ? '#fff1f2' : '#f0fdf4',
                        color: o.status === 'voided' ? 'var(--error)' : 'var(--success)',
                        border: o.status === 'voided' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                      }}
                    >
                      {o.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <strong
                      style={{ color: o.status === 'voided' ? 'var(--muted)' : 'var(--primary)' }}
                    >
                      Rs. {o.totalAmount.toLocaleString()}
                    </strong>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button
                      onClick={() => onViewReceipt(o)}
                      style={styles.viewReceiptBtn}
                      type="button"
                    >
                      <Eye size={14} />
                      <span>{t('history.printReceipt')}</span>
                    </button>
                  </td>
                </tr>
              ))}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <div style={styles.emptyContainer}>
                      <FileText size={36} color="var(--muted)" style={{ marginBottom: '8px' }} />
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600' }}>
                        {t('history.noOrdersTitle')}
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px' }}>{t('history.noOrdersSub')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Senior Table Pagination Footer */}
      <div style={styles.paginationFooter}>
        <div style={styles.paginationLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: '500' }}>
              Rows per page:
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={styles.pageSizeSelect}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: '500' }}>
            {totalCount > 0
              ? `Showing ${Math.min((page - 1) * pageSize + 1, totalCount)}–${Math.min(
                  page * pageSize,
                  totalCount
                )} of ${totalCount.toLocaleString()} sales records`
              : 'No records found'}
          </span>
        </div>

        <div style={styles.paginationRight}>
          <button
            onClick={() => setPage(1)}
            disabled={page === 1 || loading}
            title="First Page"
            style={{
              ...styles.pageNavBtn,
              opacity: page === 1 || loading ? 0.4 : 1,
              cursor: page === 1 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1 || loading}
            title="Previous Page"
            style={{
              ...styles.pageNavBtn,
              opacity: page === 1 || loading ? 0.4 : 1,
              cursor: page === 1 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--dark)' }}>
              Page {page} of {totalPages || 1}
            </span>
          </div>

          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages || loading}
            title="Next Page"
            style={{
              ...styles.pageNavBtn,
              opacity: page >= totalPages || loading ? 0.4 : 1,
              cursor: page >= totalPages || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || loading}
            title="Last Page"
            style={{
              ...styles.pageNavBtn,
              opacity: page >= totalPages || loading ? 0.4 : 1,
              cursor: page >= totalPages || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
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
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: '380px',
  },
  tableWrapper: {
    overflowX: 'auto',
    overflowY: 'auto',
    flex: 1,
    minWidth: 0,
    WebkitOverflowScrolling: 'touch',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
    tableLayout: 'fixed',
    minWidth: '1150px',
  },
  trHead: {
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  th: {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  trRow: {
    borderBottom: '1px solid var(--border)',
    height: '52px',
  },
  td: {
    padding: '10px 16px',
    fontSize: '13px',
    color: 'var(--dark)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  methodBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 'bold',
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 'bold',
  },
  viewReceiptBtn: {
    padding: '5px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--dark)',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: 'var(--muted)',
    height: '100%',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '3px solid #E5E7EB',
    borderTop: '3px solid var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  paginationFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 18px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
    flexShrink: 0,
    gap: '12px',
    flexWrap: 'wrap',
    position: 'relative',
    zIndex: 10,
  },
  paginationLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  pageSizeSelect: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #D1D5DB',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    color: '#374151',
    fontWeight: '600',
    cursor: 'pointer',
    outline: 'none',
  },
  paginationRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  pageNavBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#ffffff',
    color: '#4B5563',
    transition: 'all 0.15s ease',
  },
};
