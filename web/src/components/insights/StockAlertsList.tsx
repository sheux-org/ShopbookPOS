import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface StockAlertsListProps {
  outOfStockItems: any[];
  lowStockItems: any[];
}

export default function StockAlertsList({ outOfStockItems, lowStockItems }: StockAlertsListProps) {
  return (
    <>
      {/* Out of Stock Alerts (full row) */}
      {outOfStockItems.length > 0 && (
        <div
          className="list-panel-card critical-alerts-card"
          style={{
            border: '1.5px solid #ef4444',
            background: 'linear-gradient(135deg, #fffcfc 0%, #fef2f2 100%)',
          }}
        >
          <h3
            className="list-panel-title"
            style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span className="alert-pulse-dot" style={{ backgroundColor: '#ef4444' }} />
            <AlertTriangle size={16} />
            <span>Out of Stock Alerts (Immediate Action Required)</span>
          </h3>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {outOfStockItems.map((item: any) => (
                <tr key={item.id}>
                  <td>
                    <strong style={{ color: '#ef4444' }}>{item.name}</strong>
                  </td>
                  <td>{item.sku}</td>
                  <td>{item.category.charAt(0).toUpperCase() + item.category.slice(1)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>
                    Out of Stock
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Critical Low Stock list (full row) */}
      {lowStockItems.length > 0 && (
        <div className="list-panel-card critical-alerts-card">
          <h3
            className="list-panel-title"
            style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span className="alert-pulse-dot" />
            <AlertTriangle size={16} />
            <span>Critical Stock Alerts (Restock Required)</span>
          </h3>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Current Stock</th>
                <th style={{ textAlign: 'right' }}>Alert Limit</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item: any) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.sku}</td>
                  <td>{item.category.charAt(0).toUpperCase() + item.category.slice(1)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>
                    {item.stockCount} left
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                    {item.lowStockAlert}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
