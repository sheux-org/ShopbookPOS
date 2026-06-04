import React from 'react';
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
  return (
    <div className="ledger-list-card">
      {isLoading && (
        <div className="pane-loading-overlay">
          <Loader2 className="pane-loading-spinner" size={24} />
        </div>
      )}

      <div className="ledger-header">
        <div className="ledger-header-icon-wrapper">
          <ShoppingCart size={16} />
        </div>
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
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
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
            {orders.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '64px 24px',
                      textAlign: 'center',
                      gap: '8px',
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
                      No Invoiced Orders
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#94a3b8',
                        maxWidth: '260px',
                        lineHeight: '1.5',
                      }}
                    >
                      There are no completed or paid invoices logged within this time boundary.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
