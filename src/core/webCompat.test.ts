/**
 * Ochrona przed API, ktore w przegladarce jest CICHA ATRAPA.
 *
 * Ten test powstal po realnym zgloszeniu z telefonu: "przycisk zakoncz trening
 * nie dziala". Przyczyna byla taka, ze `Alert` z react-native-web ma cale cialo
 * postaci:
 *
 *     class Alert { static alert() {} }
 *
 * Wywolanie nie robilo nic i NIE zglaszalo bledu. Typy sie zgadzaly, lint byl
 * czysty, testy przechodzily, build sie udawal - a funkcja po prostu nie
 * istniala. Takiego bledu nie wylapie nic poza swiadomym sprawdzeniem.
 *
 * Zasada: kod WSPOLNY dla obu platform nie moze siegac po takie API
 * bezposrednio. Musi isc przez modul z wariantem .web (np. features/ui/dialogs),
 * ktory na kazdej platformie robi cos, co naprawde dziala.
 *
 * Pliki z rozszerzeniem .web sa zwolnione, bo one wlasnie dostarczaja
 * webowej implementacji, a pliki bez wariantu webowego (jak haptics.ts
 * czy dialogs.ts) sa zwolnione z tego samego powodu od strony telefonu.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/**
 * API z react-native, ktore react-native-web dostarcza jako puste atrapy
 * albo w ogole nie dostarcza.
 */
const BROKEN_ON_WEB: { name: string; pattern: RegExp; instead: string }[] = [
  {
    name: 'Alert',
    pattern: /\bAlert\s*\.\s*alert\s*\(/,
    instead: "features/ui/dialogs (notify / confirmAction)",
  },
  {
    name: 'expo-haptics',
    pattern: /from\s+'expo-haptics'/,
    instead: 'features/workout/haptics (repFeedback)',
  },
  {
    name: 'expo-secure-store',
    pattern: /from\s+'expo-secure-store'/,
    instead: 'data/api/secureStorage',
  },
];

/**
 * Pliki, ktore MOGA uzywac tych API, bo same sa warstwa platformowa:
 * albo dostarczaja wariant webowy, albo sa telefonowa polowka pary.
 */
const PLATFORM_LAYER = [
  'src/features/ui/dialogs.ts',
  'src/features/workout/haptics.ts',
  'src/data/api/secureStorage.ts',
];

function sourceFiles(): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) found.push(full);
    }
  };

  for (const dir of ['src', 'app']) walk(join(ROOT, dir));
  return found;
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

describe('zgodnosc z przegladarka: kod wspolny nie uzywa atrap', () => {
  const shared = sourceFiles()
    .map((file) => file.slice(ROOT.length + 1).split('\\').join('/'))
    .filter((rel) => !rel.includes('.web.'))
    .filter((rel) => !rel.endsWith('.test.ts') && !rel.endsWith('.test.tsx'))
    .filter((rel) => !PLATFORM_LAYER.includes(rel));

  it('jest co sprawdzac', () => {
    expect(shared.length).toBeGreaterThan(40);
  });

  it.each(BROKEN_ON_WEB)('nie uzywa $name (zamiast tego: $instead)', ({ pattern }) => {
    const offenders = shared.filter((rel) =>
      pattern.test(withoutComments(readFileSync(join(ROOT, rel), 'utf8'))),
    );

    expect(offenders).toEqual([]);
  });

  it('kazdy modul warstwy platformowej ma wariant webowy', () => {
    const missing = PLATFORM_LAYER.filter((rel) => {
      const web = rel.replace(/\.tsx?$/, (ext) => `.web${ext}`);
      try {
        statSync(join(ROOT, web));
        return false;
      } catch {
        return true;
      }
    });

    // Modul platformowy bez wariantu webowego to dokladnie ta sama pulapka,
    // tylko jeden poziom wyzej: w przegladarce zaladowalaby sie wersja
    // telefonowa i znow nic by nie dzialalo.
    expect(missing).toEqual([]);
  });
});
