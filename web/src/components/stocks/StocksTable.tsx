'use client';

import React from 'react';
import { Package, Search } from 'lucide-react';
import { ProductImage } from '../ProductImage';

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

interface StocksTableProps {
  filteredProducts: DBProduct[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onAdjustStock: (product: DBProduct) => void;
  activeTab: 'inventory' | 'audit';
}

export const StocksTable: React.FC<StocksTableProps> = ({
  filteredProducts,
  searchQuery,
  setSearchQuery,
  onAdjustStock,
  activeTab,
}) => {
  return (
    <div 
      style={styles.tablePane}
      className={`stocks-table-pane ${activeTab === 'inventory' ? 'active-pane' : 'hidden-pane'}`}
    >
      {/* Query bar */}
      <div style={styles.queryBar} className="stocks-query-bar">
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
      <div style={styles.tableWrapper} className="stocks-table-wrapper">
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
                <tr key={p.id} style={styles.tr} className="stocks-table-row">
                  <td style={styles.td}>
                    <ProductImage icon={p.icon} size={32} style={{ border: 'none', borderRadius: '6px' }} />
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 'bold', color: 'var(--dark)' }}>{p.name}</div>
                    {p.barcode && (
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                        Barcode: {p.barcode}
                      </div>
                    )}
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
                      onClick={() => onAdjustStock(p)}
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
  );
};

const styles: Record<string, React.CSSProperties> = {
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
};
