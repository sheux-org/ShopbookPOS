'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { LanguageCode } from '../../stores/settingsStore';

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage, languages, currentLanguageOption } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: compact ? '5px 10px' : '7px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border, #e5e7eb)',
          backgroundColor: '#ffffff',
          color: '#374151',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          transition: 'all 0.15s ease',
        }}
        title="Change Language / භාෂාව / மொழி"
      >
        <Globe size={14} style={{ color: '#2563eb' }} />
        <span>
          {compact ? currentLanguageOption.shortLabel : currentLanguageOption.nativeLabel}
        </span>
        <ChevronDown
          size={12}
          style={{
            color: '#6b7280',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1000,
            minWidth: '170px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '6px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            style={{
              padding: '6px 8px 4px 8px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Language / භාෂාව / மொழி
          </div>
          {languages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                  color: isSelected ? '#1d4ed8' : '#1f2937',
                  fontSize: '13px',
                  fontWeight: isSelected ? '600' : '400',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: isSelected ? '600' : '500' }}>{lang.nativeLabel}</span>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>{lang.label}</span>
                </div>
                {isSelected && <Check size={16} style={{ color: '#2563eb' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
