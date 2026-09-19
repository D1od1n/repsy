/**
 * Lokalizacja: polski i angielski.
 *
 * Zadne teksty nie sa wpisywane na sztywno w komponentach - wszystko idzie
 * przez t('klucz'). Dodanie kolejnego jezyka sprowadza sie do dorzucenia
 * pliku JSON i jednej linii w RESOURCES.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import pl from './locales/pl.json';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from './resolveLanguage';

export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  resolveLanguage,
  type SupportedLanguage,
} from './resolveLanguage';

const RESOURCES = {
  pl: { translation: pl },
  en: { translation: en },
};

let initialized = false;

export function initI18n(language: SupportedLanguage = DEFAULT_LANGUAGE): typeof i18n {
  if (!initialized) {
    void i18n.use(initReactI18next).init({
      resources: RESOURCES,
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    initialized = true;
  } else {
    void i18n.changeLanguage(language);
  }

  return i18n;
}

export function changeLanguage(language: SupportedLanguage): void {
  void i18n.changeLanguage(language);
}

export { i18n };
