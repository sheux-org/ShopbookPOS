'use client';

import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FaqModal: React.FC<FaqModalProps> = ({ isOpen, onClose }) => {
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const { t } = useTranslation();

  const faqs = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2') },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
    { q: t('faq.q5'), a: t('faq.a5') },
    { q: t('faq.q6'), a: t('faq.a6') },
    { q: t('faq.q7'), a: t('faq.a7') },
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={18} className="profile-card-icon" />
            <h3>{t('profile.faqTitle')}</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn" type="button">
            <X size={16} />
          </button>
        </div>
        <div
          className="modal-body"
          style={{ maxHeight: '480px', overflowY: 'auto', padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {faqs.map((faq, index) => {
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
