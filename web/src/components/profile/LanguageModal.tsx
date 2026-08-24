'use client';

import React from 'react';
import { X, Globe, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { LanguageCode } from '../../stores/settingsStore';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({ isOpen, onClose }) => {
  const { t, language, setLanguage, languages } = useTranslation();

  if (!isOpen) return null;

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} className="profile-card-icon" style={{ color: '#2563eb' }} />
            <h3>{t('profile.languageTitle')}</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn" type="button">
            <X size={16} />
          </button>
        </div>

        <div
          className="modal-body"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <p style={{ fontSize: '13px', color: 'var(--muted, #6b7280)', margin: '0 0 4px 0' }}>
            {t('profile.languageSub')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {languages.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <div
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid var(--border, #e5e7eb)',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#dbeafe' : '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '13px',
                        color: isSelected ? '#1d4ed8' : '#4b5563',
                      }}
                    >
                      {lang.shortLabel}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: '600',
                          fontSize: '14px',
                          color: isSelected ? '#1e3a8a' : '#111827',
                        }}
                      >
                        {lang.nativeLabel}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{lang.label}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                      }}
                    >
                      <Check size={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
