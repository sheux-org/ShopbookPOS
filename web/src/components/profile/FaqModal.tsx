'use client';

import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FAQS = [
  {
    q: 'Does Shopbook Mini POS work without an internet connection?',
    a: 'Yes! Shopbook Mini POS saves all transactions to a secure local database. You can perform billing, scan barcodes, and manage inventory offline. Cloud backup and synchronization is a premium feature available in the Shopbook Mini POS Pro version.',
  },
  {
    q: "What is a 'Quick Code' and how do cashiers use it?",
    a: "Quick Codes are short numeric shortcuts (e.g., '101' for Bread) assigned to products. Cashiers can type these in the Search bar to add items to the invoice instantly without using a scanner.",
  },
  {
    q: 'How do I scan barcodes to add items in Shopbook Mini POS?',
    a: "Tap 'Scan' in the bottom navigation or tap the search icon in the header and click the camera icon. Line up the product barcode within the viewfinder to search and add it.",
  },
  {
    q: 'How do I connect a Bluetooth thermal printer?',
    a: 'Go to Profile Settings > Bluetooth Thermal Printer. Scan for nearby devices, select your printer, and pair it. Once connected, printing receipts via Bluetooth thermal printers is a premium feature available for Shopbook Mini POS Pro users.',
  },
  {
    q: 'What can Managers and Cashiers access in Shopbook Mini POS?',
    a: 'Cashiers can only perform sales and scan barcodes, while Managers can manage stock. Granting multi-user access for staff (Managers/Cashiers) is a premium feature included in the Shopbook Mini POS Pro plan.',
  },
  {
    q: 'Can I manage multiple store locations or branches?',
    a: 'Yes! Creating and switching between multiple business branches is a premium feature in Shopbook Mini POS Pro. Upgrading lets you manage separate staff, products, and order histories for each branch.',
  },
  {
    q: 'How do Low Stock Alerts work in Shopbook Mini POS?',
    a: "When adding/editing a product, you can set a 'Low Stock Alert' threshold. When the item count drops below this, the stock text turns orange on the Home Screen to warn cashiers.",
  },
];

export const FaqModal: React.FC<FaqModalProps> = ({ isOpen, onClose }) => {
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={18} className="profile-card-icon" />
            <h3>Help & Support FAQs</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>
        <div
          className="modal-body"
          style={{ maxHeight: '480px', overflowY: 'auto', padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FAQS.map((faq, index) => {
              const isExpanded = expandedFaqIndex === index;
              return (
                <div
                  key={index}
                  className="faq-item-container"
                  style={{ borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}
                >
                  <button
                    className="faq-question-btn"
                    onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      padding: '12px 14px',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: isExpanded ? 'var(--primary)' : 'var(--dark)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: '8px',
                      transition: 'background-color 0.15s ease, color 0.15s ease',
                      backgroundColor: isExpanded ? '#f1f5f9' : 'transparent',
                    }}
                  >
                    <span style={{ marginRight: '8px' }}>{faq.q}</span>
                    {isExpanded ? (
                      <ChevronUp size={16} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                    ) : (
                      <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--muted)' }} />
                    )}
                  </button>
                  {isExpanded && (
                    <div
                      className="faq-answer-wrapper"
                      style={{
                        padding: '6px 14px 14px 14px',
                        fontSize: '12.5px',
                        color: 'var(--muted)',
                        lineHeight: '1.5',
                      }}
                    >
                      <p className="faq-answer-text" style={{ margin: 0 }}>
                        {faq.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
