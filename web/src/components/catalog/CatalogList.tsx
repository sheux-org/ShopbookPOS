'use client';

import React from 'react';
import { Star, Edit2, Trash2, Package } from 'lucide-react';
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
  isFavorite: boolean;
}

interface CatalogListProps {
  filteredProducts: DBProduct[];
  onToggleFavorite: (productId: string, currentFav: boolean) => void;
  onEditProduct: (product: DBProduct) => void;
  onDeleteProduct: (productId: string, name: string) => void;
}

export const CatalogList: React.FC<CatalogListProps> = ({
  filteredProducts,
  onToggleFavorite,
  onEditProduct,
  onDeleteProduct,
}) => {
  return (
    <div className="catalog-list-container">
      {filteredProducts.map((p) => {
        const isOut = p.stockCount <= 0;
        const isLow = p.lowStockAlert && p.stockCount <= p.lowStockAlert;
        return (
          <div key={p.id} className="catalog-item-card">
            <div className="catalog-item-left">
              {/* Star Favorite Button */}
              <button 
                onClick={() => onToggleFavorite(p.id, p.isFavorite)}
                style={styles.favBtn}
              >
                <Star 
                  size={18} 
                  fill={p.isFavorite ? 'var(--yellow)' : 'transparent'} 
                  color={p.isFavorite ? 'var(--yellow)' : 'var(--muted)'} 
                />
              </button>

              {/* Avatar / Image */}
              <div className="catalog-item-image">
                <ProductImage icon={p.icon} size={48} style={{ border: 'none', borderRadius: '8px' }} />
              </div>

              {/* Metadata Column */}
              <div className="catalog-item-meta">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="catalog-item-name">{p.name}</h3>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>({p.unitType || 'Pieces'})</span>
                </div>

                <div className="catalog-item-badges">
                  <span className="catalog-item-price">Rs. {p.price.toLocaleString()}</span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}> 
                    (Cost: Rs. {p.costPrice ? p.costPrice.toLocaleString() : (p.price * 0.8).toLocaleString()})
                  </span>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--border)' }} />
                  <span 
                    className="catalog-item-stock-badge"
                    style={{
                      backgroundColor: isOut ? '#fee2e2' : isLow ? '#ffedd5' : '#dcfce7',
                      color: isOut ? '#dc2626' : isLow ? '#d97706' : '#15803d',
                    }}
                  >
                    {isOut ? 'Out of stock' : isLow ? `Low Alert (${p.stockCount})` : `${p.stockCount} in stock`}
                  </span>
                </div>

                <div className="catalog-item-codes-row">
                  <span className="catalog-item-pill catalog-item-pill-category">
                    {p.category.toUpperCase()}
                  </span>
                  {p.quickCode && (
                    <span className="catalog-item-pill catalog-item-pill-code">
                      Code: #{p.quickCode}
                    </span>
                  )}
                  {p.barcode && (
                    <span className="catalog-item-pill catalog-item-pill-barcode">
                      Barcode: {p.barcode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions row */}
            <div className="catalog-item-actions">
              <button onClick={() => onEditProduct(p)} style={styles.editBtn} title="Edit product details">
                <Edit2 size={15} />
              </button>
              <button onClick={() => onDeleteProduct(p.id, p.name)} style={styles.deleteBtn} title="Delete product">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}

      {filteredProducts.length === 0 && (
        <div style={styles.emptyCard}>
          <Package size={36} color="var(--muted)" style={{ marginBottom: '8px', display: 'inline-block' }} />
          <h4>No catalog items found</h4>
          <p>Try searching another keyword or register a new product.</p>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  favBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '4px',
  },
  editBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  deleteBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    color: 'var(--error)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '48px 24px',
    textAlign: 'center',
    color: 'var(--muted)',
  },
};
