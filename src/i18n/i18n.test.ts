/**
 * Testy lokalizacji.
 *
 * Najwazniejszy jest pierwszy z nich: pilnuje, zeby oba jezyki mialy DOKLADNIE
 * te same klucze. Bez niego latwo dodac tekst tylko po polsku i zobaczyc
 * w angielskiej wersji goly klucz zamiast zdania.
 */
import en from './locales/en.json';
import pl from './locales/pl.json';
import { DEFAULT_LANGUAGE, resolveLanguage } from './resolveLanguage';

type Json = { [key: string]: string | Json };

/**
 * Splaszcza zagniezdzony obiekt do listy kluczy typu "home.startWorkout".
 *
 * Koncowki liczby mnogiej (_one, _few, _many, _other) sa obcinane, bo polski ma
 * cztery formy, a angielski dwie - i to jest poprawne, a nie brakujace tlumaczenie.
 */
function flatten(obj: Json, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const normalized = key.replace(/_(one|few|many|two|zero|other)$/, '');
    const path = prefix === '' ? normalized : `${prefix}.${normalized}`;
    return typeof value === 'string' ? [path] : flatten(value, path);
  });
}

function keysOf(obj: Json): Set<string> {
  return new Set(flatten(obj));
}

describe('kompletnosc tlumaczen', () => {
  it('polski i angielski maja te same klucze', () => {
    const plKeys = keysOf(pl as Json);
    const enKeys = keysOf(en as Json);

    const missingInEn = [...plKeys].filter((key) => !enKeys.has(key));
    const missingInPl = [...enKeys].filter((key) => !plKeys.has(key));

    expect(missingInEn).toEqual([]);
    expect(missingInPl).toEqual([]);
  });

  it('zaden tekst nie jest pusty', () => {
    for (const [language, bundle] of [
      ['pl', pl],
      ['en', en],
    ] as const) {
      const empty = findEmpty(bundle as Json);
      expect(`${language}: ${empty.join(', ')}`).toBe(`${language}: `);
    }
  });

  it('polski ma komplet form liczby mnogiej dla powtorzen', () => {
    const common = (pl as Json).common as Json;
    expect(common.reps_one).toBeDefined();
    expect(common.reps_few).toBeDefined();
    expect(common.reps_many).toBeDefined();
  });

  it('zawiera wymagane zdanie o prywatnosci w obu jezykach', () => {
    const enPrivacy = ((en as Json).privacy as Json).statement as string;
    const plPrivacy = ((pl as Json).privacy as Json).statement as string;

    expect(enPrivacy).toBe(
      'Camera data is processed locally on your device and is not uploaded or stored.',
    );
    expect(plPrivacy).toContain('lokalnie');
    expect(plPrivacy).toContain('nie jest wysyłany');
  });
});

describe('wybor jezyka', () => {
  it('ustawienie uzytkownika ma pierwszenstwo przed systemem', () => {
    expect(resolveLanguage('en', ['pl-PL'])).toBe('en');
    expect(resolveLanguage('pl', ['en-US'])).toBe('pl');
  });

  it('przy ustawieniu systemowym bierze pierwszy obslugiwany jezyk urzadzenia', () => {
    expect(resolveLanguage('system', ['pl-PL', 'en-US'])).toBe('pl');
    expect(resolveLanguage('system', ['en-GB'])).toBe('en');
  });

  it('nieobslugiwany jezyk systemu przechodzi na domyslny', () => {
    expect(resolveLanguage('system', ['de-DE', 'fr-FR'])).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage('system', [])).toBe(DEFAULT_LANGUAGE);
  });

  it('pomija nieobslugiwane jezyki i wybiera kolejny pasujacy', () => {
    expect(resolveLanguage('system', ['de-DE', 'pl-PL'])).toBe('pl');
  });
});

function findEmpty(obj: Json, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') return value.trim() === '' ? [path] : [];
    return findEmpty(value, path);
  });
}
