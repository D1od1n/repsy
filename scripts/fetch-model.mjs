#!/usr/bin/env node
/**
 * Pobiera model MoveNet SinglePose Lightning (TensorFlow Lite) do assets/models/.
 *
 * Model NIE jest trzymany w repo (4.6 MB, licencja Apache-2.0, plik binarny),
 * dlatego pobieramy go raz podczas instalacji.
 *
 * Zweryfikowane parametry modelu (odczytane z flatbuffera):
 *   wejscie : [1, 192, 192, 3]  UINT8
 *   wyjscie : [1, 1, 17, 3]     FLOAT32  -> 17 punktow (y, x, score) w zakresie 0..1
 *
 * Uwaga: stare adresy storage.googleapis.com/tfhub-lite-models/... zwracaja dzis 403.
 * Dziala adres tfhub.dev z parametrem ?lite-format=tflite (przekierowuje na Kaggle).
 */
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'models');
const OUT_FILE = join(OUT_DIR, 'movenet_lightning_f16.tflite');
const URL =
  'https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite';

const MIN_BYTES = 3_000_000; // model wazy ~4.6 MB; mniej = pobralo sie cos innego

async function main() {
  if (existsSync(OUT_FILE) && statSync(OUT_FILE).size > MIN_BYTES) {
    console.log('[fetch-model] Model juz istnieje, pomijam pobieranie.');
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('[fetch-model] Pobieram MoveNet Lightning (~4.6 MB)...');

  const res = await fetch(URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} przy pobieraniu modelu`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(OUT_FILE));

  const size = statSync(OUT_FILE).size;
  if (size < MIN_BYTES) {
    unlinkSync(OUT_FILE);
    throw new Error(`Pobrany plik ma tylko ${size} B - to nie jest model.`);
  }
  console.log(`[fetch-model] Gotowe: assets/models/movenet_lightning_f16.tflite (${(size / 1048576).toFixed(1)} MB)`);
}

main().catch((err) => {
  // Nie przerywamy instalacji - uzytkownik moze pobrac model pozniej: npm run fetch-model
  console.warn('\n[fetch-model] NIE UDALO SIE pobrac modelu:', err.message);
  console.warn('[fetch-model] Uruchom pozniej recznie:  npm run fetch-model');
  console.warn('[fetch-model] Bez modelu ekran treningu nie bedzie liczyl pompek.\n');
});
