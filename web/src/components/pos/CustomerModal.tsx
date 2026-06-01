'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface CustomerRecord {
  name: string;
  phone: string;
  email?: string;
}

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerRecord[];
  onAttachCustomer: (customer: CustomerRecord) => void;
  onRegisterCustomer: (name: string, phone: string, email: string) => Promise<void>;
  posMode: 'tablet' | 'normal';
  scanInputRef: React.RefObject<HTMLInputElement | null>;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  customers,
  onAttachCustomer,
  onRegisterCustomer,
  posMode,
  scanInputRef,
}) => {
  const [tab, setTab] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Customer Form States
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus appropriate input on open
  useEffect(() => {
    if (isOpen) {
      setTab('search');
      setSearchQuery('');
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) {
      alert('Please enter Name and Phone Number.');
      return;
    }
    try {
      await onRegisterCustomer(newName, newPhone, newEmail);
      onClose();
      if (posMode === 'normal') {
        setTimeout(() => scanInputRef.current?.focus(), 50);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3>Attach Customer Profile</h3>
          <button 
            onClick={() => {
              onClose();
              if (posMode === 'normal') {
                setTimeout(() => scanInputRef.current?.focus(), 50);
              }
            }} 
            style={styles.modalCloseBtn}
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Tab selector */}
        <div style={styles.tabContainer}>
          <button 
            onClick={() => {
              setTab('search');
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            style={{
              ...styles.tabBtn,
              borderBottom: tab === 'search' ? '2px solid var(--primary)' : 'none',
              color: tab === 'search' ? 'var(--primary)' : 'var(--muted)',
            }}
          >
            Search Existing [Tab]
          </button>
          <button 
            onClick={() => {
              setTab('create');
              setTimeout(() => nameInputRef.current?.focus(), 50);
            }}
            style={{
              ...styles.tabBtn,
              borderBottom: tab === 'create' ? '2px solid var(--primary)' : 'none',
              color: tab === 'create' ? 'var(--primary)' : 'var(--muted)',
            }}
          >
            Register New [Tab]
          </button>
        </div>

        {tab === 'search' ? (
          <div style={styles.modalBody}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type name or phone number to filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.modalInput}
            />
            
            <div style={styles.custListContainer}>
              {filteredCustomers.map(c => (
                <div 
                  key={c.phone} 
                  onClick={() => {
                    onAttachCustomer(c);
                    onClose();
                    if (posMode === 'normal') {
                      setTimeout(() => scanInputRef.current?.focus(), 50);
                    }
                  }}
                  style={styles.custSelectItem}
                >
                  <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    📞 {c.phone} {c.email ? ` | ✉️ ${c.email}` : ''}
                  </div>
                </div>
              ))}

              {filteredCustomers.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                  No customer profiles found. Switch tab to register.
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegisterSubmit} style={styles.modalBody}>
            <div style={styles.modalInputGroup}>
              <label style={styles.modalLabel}>Customer Name *</label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="e.g. Ruwan Silva"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                style={styles.modalInput}
              />
            </div>
            
            <div style={styles.modalInputGroup}>
              <label style={styles.modalLabel}>Mobile Number *</label>
              <input
                type="text"
                placeholder="e.g. 0771234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                style={styles.modalInput}
              />
            </div>

            <div style={styles.modalInputGroup}>
              <label style={styles.modalLabel}>Email Address</label>
              <input
                type="email"
                placeholder="e.g. ruwan@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={styles.modalInput}
              />
            </div>

            <button type="submit" style={styles.modalSubmitBtn}>
              Save Customer & Attach Profile
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
  },
  modalContent: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
  },
  tabContainer: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
  },
  tabBtn: {
    flex: 1,
    padding: '12px',
    fontSize: '13px',
    fontWeight: 'bold',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
  },
  modalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  modalInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modalLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--background)',
    boxSizing: 'border-box',
  },
  custListContainer: {
    maxHeight: '220px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '6px',
  },
  custSelectItem: {
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modalSubmitBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '6px',
  },
};
