import en from './en';
import si from './si';
import ta from './ta';

export type LanguageCode = 'en' | 'si' | 'ta';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    shortLabel: 'EN',
  },
  {
    code: 'si',
    label: 'Sinhala',
    nativeLabel: 'සිංහල',
    shortLabel: 'සිං',
  },
  {
    code: 'ta',
    label: 'Tamil',
    nativeLabel: 'தமிழ்',
    shortLabel: 'தமி',
  },
];

export const translations = { en, si, ta };

export { en, si, ta };
