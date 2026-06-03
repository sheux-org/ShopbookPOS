import React from 'react';
import { ShoppingBag } from 'lucide-react';

interface BestsellersListProps {
  bestSellers: any[];
}

export default function BestsellersList({ bestSellers }: BestsellersListProps) {
  return (
    <div className="list-panel-card">
      <h3 className="list-panel-title">🔥 Best Selling Products</h3>
      <table className="mini-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}>Rank</th>
            <th>Product</th>
            <th style={{ textAlign: 'right' }}>Units</th>
            <th style={{ textAlign: 'right' }}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {bestSellers.map((item: any, idx: number) => (
            <tr key={idx}>
              <td>
                <span className={`rank-badge ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'gray'}`}>
                  {idx + 1}
                </span>
              </td>
              <td><strong>{item.name}</strong></td>
              <td style={{ textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Rs. {Math.round(item.revenue).toLocaleString()}</td>
            </tr>
          ))}
          {bestSellers.length === 0 && (
            <tr>
              <td colSpan={4}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 16px',
                  color: 'var(--muted)',
                  textAlign: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    marginBottom: '4px'
                  }}>
                    <ShoppingBag size={20} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#475569' }}>No Sales Data</h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', maxWidth: '240px', lineHeight: '1.4' }}>
                    No sales logs have been recorded for this product during the selected period.
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
