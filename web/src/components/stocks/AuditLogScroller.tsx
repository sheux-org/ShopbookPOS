'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { ProductImage } from '../ProductImage';

interface DBInventoryLog {
  id: string;
  productName: string;
  productIcon: string;
  type: 'in' | 'out';
  quantity: number;
  reason?: string;
  date: string;
}

interface AuditLogScrollerProps {
  logs: DBInventoryLog[];
  activeTab: 'inventory' | 'audit';
}

export const AuditLogScroller: React.FC<AuditLogScrollerProps> = ({
  logs,
  activeTab,
}) => {
  return (
    <div 
      style={styles.logPane}
      className={`stocks-log-pane ${activeTab === 'audit' ? 'active-pane' : 'hidden-pane'}`}
    >
      <div style={styles.logScroller} className="stocks-log-scroller">
        {logs.map((log) => {
          const isIn = log.type === 'in';
          return (
            <div key={log.id} style={styles.logCard} className="stocks-log-card">
              <div style={styles.logCardTop}>
                <ProductImage icon={log.productIcon} size={32} style={{ border: 'none', borderRadius: '6px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={styles.logCardName}>{log.productName}</h4>
                  <p style={styles.logCardDate}>{log.date}</p>
                </div>

                <div style={{
                  ...styles.logCardTypeBadge,
                  backgroundColor: isIn ? '#DCFCE7' : '#FEE2E2',
                  color: isIn ? '#16A34A' : '#DC2626',
                }}>
                  {isIn ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                  <span>{isIn ? '+' : '-'}{log.quantity}</span>
                </div>
              </div>
              {log.reason && (
                <p style={styles.logCardReason}>Reason: {log.reason}</p>
              )}
            </div>
          );
        })}

        {logs.length === 0 && (
          <div style={styles.emptyLogState}>
            <p>No inventory adjustments logged yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  logPane: {
    flex: 3,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  logScroller: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  logCard: {
    backgroundColor: 'var(--background)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    padding: '12px',
  },
  logCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logCardName: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--dark)',
  },
  logCardDate: {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  logCardTypeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  logCardReason: {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '6px',
    paddingLeft: '42px',
  },
  emptyLogState: {
    padding: '36px 12px',
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '12px',
  },
};
