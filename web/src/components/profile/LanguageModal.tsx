'use client';

import React from 'react';
import { Globe, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { LanguageCode } from '../../stores/settingsStore';
import { SideDrawer } from '../common/SideDrawer';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({ isOpen, onClose }) => {
  const { t, language, setLanguage, languages } = useTranslation();

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    onClose();
  };

  const drawerFooter = (
    <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end' }}>
      <button
        type="button"
        onClick={onClose}
        className="modal-submit-btn"
        style={{ margin: 0, width: 'auto' }}
      >
        <span>{t('common.done')}</span>
      </button>
    </div>
  );

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('profile.languageTitle')}
      subtitle={t('profile.languageSub')}
      icon={<Globe size={20} />}
      footer={drawerFooter}
      maxWidth="500px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '13px',
                    color: isSelected ? 'var(--primary)' : '#475569',
                  }}
                >
                  {lang.shortLabel}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: '700',
                      fontSize: '14px',
                      color: isSelected ? 'var(--primary)' : 'var(--dark)',
                    }}
                  >
                    {lang.nativeLabel}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px' }}>
                    {lang.label}
                  </div>
                </div>
              </div>

              {isSelected && (
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
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
    </SideDrawer>
  );
};
