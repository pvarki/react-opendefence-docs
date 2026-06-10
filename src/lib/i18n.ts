import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type Locale,
} from "@shared/content-schema";
import en from "@/locales/en.json";
import fi from "@/locales/fi.json";
import sv from "@/locales/sv.json";

const STORAGE_KEY = "language";

/**
 * Locale resolution is deliberately simple: the stored explicit choice wins,
 * otherwise English — never navigator.language (decided: default en always).
 */
export function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const normalized = normalizeLocale(stored);
      if (normalized) return normalized;
    }
  } catch {
    // storage unavailable (private mode etc.) — fall through to default
  }
  return DEFAULT_LOCALE;
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // non-fatal
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fi: { translation: fi },
    sv: { translation: sv },
  },
  lng: getStoredLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
});

export default i18n;
