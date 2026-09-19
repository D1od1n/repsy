/**
 * Automatyczna kontrola obietnicy prywatnosci.
 *
 * Deklaracja "obraz z kamery nie opuszcza urzadzenia" jest w tym projekcie
 * wymogiem nadrzednym. Komentarz w kodzie takiej obietnicy nie egzekwuje -
 * ten test tak. Przeglada ZRODLA i nie pozwala, zeby ktos (lacznie z przyszla
 * wersja tego samego autora) dolozyl wywolanie, ktore obraz zapisuje,
 * przechowuje albo wysyla.
 *
 * Testy uzupelniajace, sprawdzajace to samo od innej strony:
 *   - data/db/database.test.ts     - schemat bazy nie ma kolumny na obraz,
 *   - core/sync/syncEngine.test.ts - payload synchronizacji nie zawiera obrazu.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/** Katalogi z kodem aplikacji (bez zaleznosci i plikow wygenerowanych). */
const SOURCE_DIRS = ['src', 'app'];

const CAMERA_WEB = join(ROOT, 'src', 'features', 'workout', 'usePoseDetection.web.tsx');

/**
 * API, ktorymi dalo by sie zapisac albo wyslac obraz.
 *
 * Kazdy wpis ma wyjasnienie - gdy test kiedys zaswieci na czerwono, ma byc
 * od razu wiadomo, czego dotyczy problem, a nie tylko ze "cos pasuje".
 */
const FORBIDDEN: { name: string; pattern: RegExp; why: string }[] = [
  { name: 'MediaRecorder', pattern: /\bMediaRecorder\b/, why: 'nagrywanie strumienia do pliku' },
  { name: 'toDataURL', pattern: /\.toDataURL\s*\(/, why: 'klatka jako obrazek w tekscie' },
  { name: 'toBlob', pattern: /\.toBlob\s*\(/, why: 'klatka jako plik binarny' },
  { name: 'captureStream', pattern: /\bcaptureStream\s*\(/, why: 'przechwycenie strumienia' },
  { name: 'ImageCapture', pattern: /\bImageCapture\b/, why: 'robienie zdjec ze strumienia' },
  { name: 'getImageData', pattern: /\bgetImageData\s*\(/, why: 'odczyt surowych pikseli' },
  { name: 'takePhoto', pattern: /\btakePhoto\b/, why: 'zdjecie z kamery (API mobilne)' },
  { name: 'startRecording', pattern: /\bstartRecording\b/, why: 'nagrywanie wideo (API mobilne)' },
  { name: 'MediaLibrary', pattern: /\bMediaLibrary\b/, why: 'zapis do galerii urzadzenia' },
  { name: 'CameraRoll', pattern: /\bCameraRoll\b/, why: 'zapis do galerii urzadzenia' },
];

/**
 * Usuwa komentarze przed sprawdzeniem.
 *
 * Bez tego test wywracal sie na WLASNYM komentarzu wyjasniajacym, ze
 * "nie ma tu MediaRecorder". Sprawdzamy, czy zakazane API jest UZYWANE,
 * a nie czy ktos o nim napisal - opisywanie w komentarzu, czego kod
 * swiadomie nie robi, jest wartosciowe i nie moze byc karane.
 *
 * Uproszczenie: sekwencja wygladajaca jak komentarz wewnatrz literalu
 * tekstowego tez zostanie usunieta. Dla tego testu jest to bezpieczne -
 * moze najwyzej ukryc fragment kodu, a nigdy nie stworzy falszywego alarmu.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function codeOf(file: string): string {
  return withoutComments(readFileSync(file, 'utf8'));
}

/** Zbiera wszystkie pliki .ts/.tsx z podanych katalogow. */
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

  for (const dir of SOURCE_DIRS) walk(join(ROOT, dir));
  return found;
}

describe('prywatnosc: obraz z kamery nie opuszcza urzadzenia', () => {
  const files = sourceFiles().filter((file) => !file.endsWith('privacy.test.ts'));

  it('w zrodlach jest co sprawdzac', () => {
    // Zabezpieczenie przed testem, ktory "przechodzi", bo nic nie znalazl.
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(FORBIDDEN)('nie uzywa $name ($why)', ({ pattern }) => {
    const offenders = files
      .filter((file) => pattern.test(codeOf(file)))
      .map((file) => file.slice(ROOT.length + 1));

    expect(offenders).toEqual([]);
  });

  it('modul kamery w przegladarce nie wykonuje zadnych zapytan sieciowych', () => {
    const source = codeOf(CAMERA_WEB);

    // Model laduje TensorFlow.js z naszego wlasnego katalogu public/ i to
    // jedyny ruch sieciowy zwiazany z ta funkcja. Sam modul nie ma prawa
    // wysylac niczego samodzielnie.
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/sendBeacon/);
    expect(source).not.toMatch(/new\s+WebSocket/);
  });

  it('modul kamery w przegladarce zatrzymuje wszystkie sciezki strumienia', () => {
    const source = codeOf(CAMERA_WEB);

    // Dopoki choc jedna sciezka zyje, kamera pozostaje wlaczona. Zatrzymanie
    // musi obejmowac wszystkie, a nie tylko pierwsza.
    expect(source).toMatch(/getTracks\(\)/);
    expect(source).toMatch(/track\.stop\(\)/);
  });

  it('nie prosi o dostep do mikrofonu', () => {
    expect(codeOf(CAMERA_WEB)).toMatch(/audio:\s*false/);
  });

  it('Service Worker nie zapisuje w pamieci podrecznej odpowiedzi z backendu', () => {
    // Odpowiedzi Supabase zawieraja dane uzytkownika i tokeny. Gdyby trafily
    // do pamieci podrecznej, zostawalyby na dysku takze po wylogowaniu.
    const source = codeOf(join(ROOT, 'public', 'sw.js'));

    expect(source).toMatch(/url\.origin !== self\.location\.origin/);
  });
});
