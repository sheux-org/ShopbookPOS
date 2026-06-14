import React, { useState, useMemo } from 'react';
import { ShoppingCart, Eye, Loader2, Receipt } from 'lucide-react';

interface TransactionLedgerProps {
  orders: any[];
  onViewReceipt: (order: any) => void;
  isLoading?: boolean;
}

export default function TransactionLedger({
  orders,
  onViewReceipt,
  isLoading,
}: TransactionLedgerProps) {
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'card' | 'bank'>('all');

  // Filter orders based on the selected method
  const filteredOrders = useMemo(() => {
    if (methodFilter === 'all') return orders;
    return orders.filter((o) => (o.paymentMethod || 'cash').toLowerCase() === methodFilter);
  }, [orders, methodFilter]);

  // Compute the total of the currently filtered/active orders
  const activeTotal = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [filteredOrders]);

  return (
    <div className="ledger-list-card">
      {isLoading && (
        <div className="pane-loading-overlay">
          <Loader2 className="pane-loading-spinner" size={24} />
        </div>
      )}

      <div
        className="ledger-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="ledger-header-icon-wrapper">
            <ShoppingCart size={16} />
          </div>
          <h3 className="ledger-title">Transaction Ledger</h3>
        </div>

        {/* Optimized Segmented Payment Method Filters */}
        <div className="ledger-payment-filter-bar">
          <button
            className={`ledger-payment-filter-btn ${methodFilter === 'all' ? 'active' : ''}`}
            onClick={() => setMethodFilter('all')}
          >
            All
          </button>
          <button
            className={`ledger-payment-filter-btn ${methodFilter === 'cash' ? 'active' : ''}`}
            onClick={() => setMethodFilter('cash')}
          >
            Cash
          </button>
          <button
            className={`ledger-payment-filter-btn ${methodFilter === 'card' ? 'active' : ''}`}
            onClick={() => setMethodFilter('card')}
          >
            Card
          </button>
          <button
            className={`ledger-payment-filter-btn ${methodFilter === 'bank' ? 'active' : ''}`}
            onClick={() => setMethodFilter('bank')}
          >
            Bank
          </button>
        </div>
      </div>

      {/* Dynamic Summary Bar with active totals */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '14px',
          fontSize: '12.5px',
          color: '#64748b',
          fontWeight: 600,
        }}
      >
        <span>
          Showing {filteredOrders.length}{' '}
          {filteredOrders.length === 1 ? 'transaction' : 'transactions'}
        </span>
        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
          Total: Rs.{' '}
          {activeTotal.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>

      <div className="ledger-table-wrapper">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Receipt</th>
            </tr>
          </thead>
          {filteredOrders.length > 0 && (
            <tbody>
              {filteredOrders.map((o: any) => (
                <tr key={o.id}>
                  <td>
                    <span className="ledger-invoice-num">{o.invoiceNumber.split(' ')[0]}</span>
                  </td>
                  <td>
                    <span className="ledger-date">{o.date}</span>
                  </td>
                  <td>
                    <span className={`ledger-method-badge method-${o.paymentMethod.toLowerCase()}`}>
                      {o.paymentMethod.toUpperCase()}
                    </span>
                  </td>
                  <td className="ledger-amount-cell">Rs. {o.totalAmount.toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => onViewReceipt(o)}
                      className="ledger-view-btn"
                      title="View Printable Invoice Receipt"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>

        {filteredOrders.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 24px',
              textAlign: 'center',
              gap: '8px',
              width: '100%',
              boxSizing: 'border-box',
              whiteSpace: 'normal',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#f8fafc',
                border: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                marginBottom: '4px',
              }}
            >
              <Receipt size={24} />
            </div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#475569' }}>
              {orders.length === 0 ? 'No Invoiced Orders' : 'No Matching Invoices'}
            </h4>
            <p
              style={{
                margin: '0 auto',
                fontSize: '12px',
                color: '#94a3b8',
                maxWidth: '260px',
                lineHeight: '1.5',
                whiteSpace: 'normal',
              }}
            >
              {orders.length === 0
                ? 'There are no completed or paid invoices logged within this time boundary.'
                : 'There are no paid invoices matching the selected payment method filter.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
