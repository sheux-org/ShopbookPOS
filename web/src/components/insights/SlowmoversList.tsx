import React from 'react';
import { TrendingUp } from 'lucide-react';

interface SlowmoversListProps {
  slowMovers: any[];
}

export default function SlowmoversList({ slowMovers }: SlowmoversListProps) {
  return (
    <div className="list-panel-card">
      <h3 className="list-panel-title">⏳ Slow Moving Inventory</h3>
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
          {slowMovers.map((item: any, idx: number) => (
            <tr key={idx}>
              <td><span className="rank-badge gray">{idx + 1}</span></td>
              <td><strong>{item.name}</strong></td>
              <td style={{ textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Rs. {Math.round(item.revenue).toLocaleString()}</td>
            </tr>
          ))}
          {slowMovers.length === 0 && (
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
                    backgroundColor: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    marginBottom: '4px'
                  }}>
                    <TrendingUp size={20} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Healthy Inventory Velocity</h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', maxWidth: '240px', lineHeight: '1.4' }}>
                    All products are moving actively! No stagnant stock records found.
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
