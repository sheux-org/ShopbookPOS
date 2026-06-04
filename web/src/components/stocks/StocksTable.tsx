'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Package, Search, Plus } from 'lucide-react';
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
  onAddItem: () => void;
  activeTab: 'inventory' | 'audit';
}

export const StocksTable: React.FC<StocksTableProps> = ({
  filteredProducts,
  searchQuery,
  setSearchQuery,
  onAdjustStock,
  onAddItem,
  activeTab,
}) => {
  const router = useRouter();

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
        <button onClick={onAddItem} style={styles.addBtn}>
          <Plus size={14} />
          <span>Add New Item</span>
        </button>
      </div>

      {/* Table Container */}
      <div style={styles.tableWrapper} className="stocks-table-wrapper">
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <th style={styles.th} colSpan={2}>
                Product Name
              </th>
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
                <tr
                  key={p.id}
                  style={{ ...styles.tr, cursor: 'pointer' }}
                  className="stocks-table-row"
                  onMouseEnter={() => router.prefetch(`/stocks/${p.id}`)}
                  onClick={() => router.push(`/stocks/${p.id}`)}
                >
                  <td style={styles.td}>
                    <ProductImage
                      icon={p.icon}
                      size={32}
                      style={{ border: 'none', borderRadius: '6px' }}
                    />
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
                    <span
                      style={{
                        ...styles.stockIndicator,
                        backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FFEDD5' : '#DCFCE7',
                        color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D',
                      }}
                    >
                      {p.stockCount} {p.unitType || 'Units'}
                    </span>
                  </td>
                  <td style={styles.td}>{p.lowStockAlert ? `${p.lowStockAlert} Units` : '-'}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdjustStock(p);
                      }}
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
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    gap: '16px',
  },
  queryBar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
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
    marginBottom: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  thRow: {
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  },
  th: {
    padding: '10px 10px',
    textAlign: 'left',
    fontWeight: '700',
    color: '#475569',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '7px 10px',
    verticalAlign: 'middle',
  },
  stockIndicator: {
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  adjustRowBtn: {
    padding: '5px 10px',
    borderRadius: '12px',
    border: '1px solid var(--accent-blue)',
    backgroundColor: 'var(--light-blue)',
    color: 'var(--primary)',
    fontWeight: 'bold',
    fontSize: '10px',
    cursor: 'pointer',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'var(--primary)',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: 'var(--shadow)',
    transition: 'opacity 0.15s',
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
