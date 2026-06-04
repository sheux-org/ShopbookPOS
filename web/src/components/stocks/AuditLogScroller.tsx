'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownLeft, History } from 'lucide-react';
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

export const AuditLogScroller: React.FC<AuditLogScrollerProps> = ({ logs, activeTab }) => {
  return (
    <div
      style={styles.logPane}
      className={`stocks-log-pane ${activeTab === 'audit' ? 'active-pane' : 'hidden-pane'}`}
    >
      {/* Section header — always visible title */}
      <div style={styles.logHeader}>
        <History size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={styles.logHeaderTitle}>Product Log</span>
      </div>

      <div style={styles.logScroller} className="stocks-log-scroller">
        {logs.map((log) => {
          const isIn = log.type === 'in';
          return (
            <div key={log.id} style={styles.logCard} className="stocks-log-card">
              <div style={styles.logCardTop}>
                <ProductImage
                  icon={log.productIcon}
                  size={28}
                  style={{ border: 'none', borderRadius: '6px', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={styles.logCardName}>{log.productName}</h4>
                  <p style={styles.logCardDate}>{log.date}</p>
                </div>

                <div
                  style={{
                    ...styles.logCardTypeBadge,
                    backgroundColor: isIn ? '#DCFCE7' : '#FEE2E2',
                    color: isIn ? '#16A34A' : '#DC2626',
                  }}
                >
                  {isIn ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
                  <span>
                    {isIn ? '+' : '-'}
                    {log.quantity}
                  </span>
                </div>
              </div>
              {log.reason && <p style={styles.logCardReason}>Reason: {log.reason}</p>}
            </div>
          );
        })}

        {logs.length === 0 && (
          <div style={styles.emptyLogState}>
            <History size={24} style={{ color: 'var(--muted)', opacity: 0.4 }} />
            <p>No inventory adjustments logged yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  logPane: {
    flex: 1,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.03)',
  },
  logHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '16px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  logHeaderTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--dark)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  logScroller: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  logCard: {
    backgroundColor: 'var(--background)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    padding: '7px 8px',
  },
  logCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logCardName: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--dark)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logCardDate: {
    fontSize: '9px',
    color: 'var(--muted)',
    marginTop: '1px',
  },
  logCardTypeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '10px',
    flexShrink: 0,
  },
  logCardReason: {
    fontSize: '9px',
    color: 'var(--muted)',
    marginTop: '4px',
    paddingLeft: '36px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  emptyLogState: {
    padding: '32px 12px',
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '11px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
};
