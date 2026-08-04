import { useSettingsStore } from '../stores/useSettingsStore';
import en from '../locales/en';
import si from '../locales/si';
import ta from '../locales/ta';

const translations = { en, si, ta };

export function useTranslation() {
  const language = useSettingsStore((state) => state.language) || 'en';
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const t = (keyPath: string, replacements?: Record<string, string>): string => {
    const keys = keyPath.split('.');
    let val: any = translations[language];
    for (const key of keys) {
      if (val && typeof val === 'object') {
        val = val[key];
      } else {
        return keyPath; // fallback
      }
    }

    if (typeof val === 'string') {
      let result = val;
      if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, v);
        });
      }
      return result;
    }

    return keyPath;
  };

  return { t, language, setLanguage };
}
