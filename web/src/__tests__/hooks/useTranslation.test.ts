import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { translations } from '../../locales';

describe('useTranslation Hook', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      language: 'en',
    });
  });

  test('should return English translation by default', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.language).toBe('en');
    expect(result.current.t('common.save')).toBe('Save');
    expect(result.current.t('navigation.pos')).toBe('POS Billing');
  });

  test('should return Sinhala translation when language is set to "si"', () => {
    const { result } = renderHook(() => useTranslation());

    act(() => {
      result.current.setLanguage('si');
    });

    expect(result.current.language).toBe('si');
    expect(result.current.t('common.save')).toBe('සුරකින්න');
    expect(result.current.t('navigation.pos')).toBe('POS විකුණුම්');
    expect(result.current.t('cart.title')).toBe('කාර්ට් එක');
  });

  test('should return Tamil translation when language is set to "ta"', () => {
    const { result } = renderHook(() => useTranslation());

    act(() => {
      result.current.setLanguage('ta');
    });

    expect(result.current.language).toBe('ta');
    expect(result.current.t('common.save')).toBe('சேமி');
    expect(result.current.t('navigation.pos')).toBe('POS பில்லிங்');
    expect(result.current.t('cart.title')).toBe('வண்டி');
  });

  test('should replace dynamic template parameters correctly', () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.t('payment.exactAmount', { amount: '2,500' })).toBe('Exact · Rs. 2,500');

    act(() => {
      result.current.setLanguage('si');
    });
    expect(result.current.t('payment.exactAmount', { amount: '2,500' })).toBe('හරියටම · Rs. 2,500');

    act(() => {
      result.current.setLanguage('ta');
    });
    expect(result.current.t('payment.exactAmount', { amount: '2,500' })).toBe(
      'சரியான தொகை · Rs. 2,500'
    );
  });

  test('should fallback to English if key is missing in another language', () => {
    const { result } = renderHook(() => useTranslation());

    act(() => {
      result.current.setLanguage('si');
    });

    // Valid common key should work
    expect(result.current.t('common.loading')).toBe('දත්ත ලෝඩ් වෙමින් පවතී...');

    // Non-existent key should return fallback keyPath
    expect(result.current.t('nonExistent.nestedKey')).toBe('nonExistent.nestedKey');
  });

  test('should provide supported languages metadata', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.languages).toHaveLength(3);
    expect(result.current.languages.map((l) => l.code)).toEqual(['en', 'si', 'ta']);
    expect(result.current.currentLanguageOption.code).toBe('en');
  });

  test('should ensure all keys in en dictionary are translated in si and ta', () => {
    const getLeafKeys = (obj: any, prefix = ''): string[] => {
      let keys: string[] = [];
      for (const k of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          keys.push(...getLeafKeys(obj[k], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys;
    };

    const enKeys = getLeafKeys(translations.en);
    const getVal = (obj: any, path: string) => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    const missingInSi = enKeys.filter((k) => typeof getVal(translations.si, k) !== 'string');
    const missingInTa = enKeys.filter((k) => typeof getVal(translations.ta, k) !== 'string');

    if (missingInSi.length > 0) {
      console.error('Missing in Sinhala (si):', missingInSi);
    }
    if (missingInTa.length > 0) {
      console.error('Missing in Tamil (ta):', missingInTa);
    }

    expect(missingInSi).toEqual([]);
    expect(missingInTa).toEqual([]);
  });

  test('should ensure every t() key in the codebase exists in the translations dictionary', () => {
    const fs = require('fs');
    const path = require('path');

    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (
          stat.isDirectory() &&
          file !== 'node_modules' &&
          file !== '.next' &&
          file !== '__tests__'
        ) {
          results.push(...scanFiles(full));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          results.push(full);
        }
      }
      return results;
    }

    const files = scanFiles(path.resolve(__dirname, '../../'));
    const usedKeys = new Set<string>();
    const keyRegex = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;

    for (const f of files) {
      if (f.includes('locales')) continue;
      const content = fs.readFileSync(f, 'utf8');
      let match;
      while ((match = keyRegex.exec(content)) !== null) {
        usedKeys.add(match[1]);
      }
    }

    const getVal = (obj: any, path: string) => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    const missingKeys: string[] = [];
    for (const k of usedKeys) {
      if (typeof getVal(translations.en, k) !== 'string') {
        missingKeys.push(k);
      }
    }

    if (missingKeys.length > 0) {
      console.error('Keys used in code but missing from translations.en:', missingKeys);
    }
    expect(missingKeys).toEqual([]);
  });
});
