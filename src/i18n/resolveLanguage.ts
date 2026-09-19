/**
 * Wybor jezyka - wydzielony do osobnego pliku, zeby dalo sie go testowac
 * bez wciagania calego react-i18next i React Native.
 */
import type { LanguagePreference } from '../core/model';

export const SUPPORTED_LANGUAGES = ['pl', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
}

/**
 * Ustawienie uzytkownika ma pierwszenstwo. Przy "systemowym" bierzemy pierwszy
 * jezyk urzadzenia, ktory obslugujemy - np. dla ['pl-PL', 'en-US'] bedzie to 'pl'.
 */
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguages: readonly string[],
): SupportedLanguage {
  if (preference !== 'system') return preference;

  for (const tag of deviceLanguages) {
    const base = tag.split('-')[0]?.toLowerCase();
    if (base !== undefined && isSupportedLanguage(base)) return base;
  }

  return DEFAULT_LANGUAGE;
}
