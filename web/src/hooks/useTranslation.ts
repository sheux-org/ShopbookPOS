'use client';

import { useSettingsStore, LanguageCode } from '../stores/settingsStore';
import { translations, SUPPORTED_LANGUAGES, LanguageOption } from '../locales';

export type TranslationKey = string;

export function useTranslation() {
  const language = useSettingsStore((state) => state.language) || 'en';
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const t = (keyPath: string, replacements?: Record<string, string | number>): string => {
    if (!keyPath) return '';
    const keys = keyPath.split('.');

    // Try current language dictionary
    let val: unknown = (translations as Record<string, unknown>)[language];
    for (const key of keys) {
      if (val && typeof val === 'object' && key in (val as Record<string, unknown>)) {
        val = (val as Record<string, unknown>)[key];
      } else {
        val = undefined;
        break;
      }
    }

    // Fallback to English dictionary if key not resolved or not a string
    if (typeof val !== 'string' && language !== 'en') {
      let fallbackVal: unknown = translations.en;
      for (const key of keys) {
        if (
          fallbackVal &&
          typeof fallbackVal === 'object' &&
          key in (fallbackVal as Record<string, unknown>)
        ) {
          fallbackVal = (fallbackVal as Record<string, unknown>)[key];
        } else {
          fallbackVal = undefined;
          break;
        }
      }
      if (typeof fallbackVal === 'string') {
        val = fallbackVal;
      }
    }

    // If still not a string, return keyPath as ultimate fallback
    if (typeof val !== 'string') {
      return keyPath;
    }

    // Dynamic Parameter Interpolation: replaces {param} with corresponding value
    let result = val;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return result;
  };

  const currentLanguageOption: LanguageOption =
    SUPPORTED_LANGUAGES.find((lang) => lang.code === language) || SUPPORTED_LANGUAGES[0];

  return {
    t,
    language,
    setLanguage,
    languages: SUPPORTED_LANGUAGES,
    currentLanguageOption,
  };
}
