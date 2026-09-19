#!/usr/bin/env node
/**
 * Pobiera model MoveNet SinglePose Lightning w DWOCH formatach:
 *
 *   1. TensorFlow Lite  -> assets/models/            (aplikacja na telefonie)
 *   2. TensorFlow.js    -> public/models/movenet/    (wersja webowa / PWA)
 *
 * To ten sam model i te same 17 punktow COCO, wiec algorytm liczenia pompek
 * i jego progi dzialaja identycznie na obu platformach. Rozni sie tylko format
 * pliku, bo w przegladarce nie ma interpretera TFLite.
 *
 * Modele NIE sa trzymane w repo (razem ~9 MB, pliki binarne, licencja
 * Apache-2.0), dlatego pobieramy je raz podczas instalacji.
 *
 * Zweryfikowane parametry wersji TFLite (odczytane z flatbuffera):
 *   wejscie : [1, 192, 192, 3]  UINT8
 *   wyjscie : [1, 1, 17, 3]     FLOAT32  -> 17 punktow (y, x, score) w zakresie 0..1
 *
 * Wersja webowa jest pobierana LOKALNIE celowo. Gdyby model ladowal sie z obcej
 * domeny w trakcie dzialania strony, trzeba by otworzyc na nia polityke CSP
 * (connect-src) i aplikacja nie dzialalaby offline. Trzymajac model u siebie,
 * mozemy zablokowac polaczenia wszedzie poza wlasnym serwerem i Supabase.
 *
 * Uwaga: stare adresy storage.googleapis.com/tfhub-lite-models/... zwracaja dzis 403.
 * Dziala adres tfhub.dev (przekierowuje na Kaggle, bez logowania).
 */
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Wersja dla telefonu. */
const TFLITE_DIR = join(ROOT, 'assets', 'models');
const TFLITE_FILE = join(TFLITE_DIR, 'movenet_lightning_f16.tflite');
const TFLITE_URL =
  'https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite';
const TFLITE_MIN_BYTES = 3_000_000; // ~4.6 MB; mniej = pobralo sie cos innego

/** Wersja dla przegladarki (graph model: opis + wagi w osobnych plikach). */
const WEB_DIR = join(ROOT, 'public', 'models', 'movenet');
const WEB_BASE = 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4';
const WEB_FILES = [
  { name: 'model.json', minBytes: 10_000 },
  { name: 'group1-shard1of2.bin', minBytes: 3_000_000 },
  { name: 'group1-shard2of2.bin', minBytes: 300_000 },
];

async function download(url, target, minBytes) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} przy ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));

  const size = statSync(target).size;
  if (size < minBytes) {
    unlinkSync(target);
    throw new Error(`Pobrany plik ma tylko ${size} B - to nie jest oczekiwany model.`);
  }
  return size;
}

async function fetchTflite() {
  if (existsSync(TFLITE_FILE) && statSync(TFLITE_FILE).size > TFLITE_MIN_BYTES) {
    console.log('[fetch-model] TFLite juz istnieje, pomijam.');
    return;
  }
  mkdirSync(TFLITE_DIR, { recursive: true });
  console.log('[fetch-model] Pobieram MoveNet Lightning dla telefonu (~4.6 MB)...');
  const size = await download(TFLITE_URL, TFLITE_FILE, TFLITE_MIN_BYTES);
  console.log(
    `[fetch-model] Gotowe: assets/models/movenet_lightning_f16.tflite (${(size / 1048576).toFixed(1)} MB)`,
  );
}

async function fetchWeb() {
  const complete = WEB_FILES.every(
    (f) => existsSync(join(WEB_DIR, f.name)) && statSync(join(WEB_DIR, f.name)).size > f.minBytes,
  );
  if (complete) {
    console.log('[fetch-model] Model webowy juz istnieje, pomijam.');
    return;
  }

  mkdirSync(WEB_DIR, { recursive: true });
  console.log('[fetch-model] Pobieram MoveNet Lightning dla przegladarki (~4.4 MB)...');

  let total = 0;
  for (const file of WEB_FILES) {
    total += await download(`${WEB_BASE}/${file.name}?tfjs-format=file`, join(WEB_DIR, file.name), file.minBytes);
  }
  console.log(
    `[fetch-model] Gotowe: public/models/movenet/ (${(total / 1048576).toFixed(1)} MB, ${WEB_FILES.length} pliki)`,
  );
}

async function main() {
  // Bledy zbieramy osobno: brak jednego formatu nie powinien blokowac drugiego.
  const problems = [];
  for (const [label, task] of [
    ['telefon (TFLite)', fetchTflite],
    ['przegladarka (TensorFlow.js)', fetchWeb],
  ]) {
    try {
      await task();
    } catch (err) {
      problems.push(`${label}: ${err.message}`);
    }
  }
  if (problems.length > 0) throw new Error(problems.join('; '));
}

main().catch((err) => {
  // Nie przerywamy instalacji - model mozna pobrac pozniej: npm run fetch-model
  console.warn('\n[fetch-model] NIE UDALO SIE pobrac modelu:', err.message);
  console.warn('[fetch-model] Uruchom pozniej recznie:  npm run fetch-model');
  console.warn('[fetch-model] Bez modelu ekran treningu nie bedzie liczyl pompek.\n');
});
