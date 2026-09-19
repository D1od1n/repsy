/**
 * Sciezka bazowa aplikacji w wersji webowej.
 *
 * Na GitHub Pages strona nie stoi w korzeniu domeny, tylko w podkatalogu
 * nazwanym jak repozytorium (np. https://ktos.github.io/Push-ups/). Wszystkie
 * odwolania do plikow statycznych musza ten podkatalog uwzgledniac, inaczej
 * przegladarka szukalaby ich w korzeniu i dostawala 404.
 *
 * Wartosc pochodzi z `experiments.baseUrl` w app.config.js, ktore Expo wpisuje
 * takze do wygenerowanego HTML-a.
 */
import Constants from 'expo-constants';

/** Sciezka bazowa zawsze zakonczona ukosnikiem ('/' gdy aplikacja stoi w korzeniu). */
export function basePath(): string {
  const configured = (
    Constants.expoConfig?.experiments as { baseUrl?: string } | undefined
  )?.baseUrl;

  if (typeof configured !== 'string' || configured === '') return '/';
  return configured.endsWith('/') ? configured : `${configured}/`;
}

/**
 * Adres pliku z katalogu public/.
 *
 * @param relative sciezka wzgledem public/, bez poczatkowego ukosnika
 */
export function assetUrl(relative: string): string {
  return `${basePath()}${relative.replace(/^\/+/, '')}`;
}
