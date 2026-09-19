#!/usr/bin/env node
/**
 * Kopiuje pliki, ktore wersja webowa serwuje z katalogu public/,
 * a ktore pochodza z zainstalowanych pakietow.
 *
 * Dlaczego skryptem, a nie recznie raz na zawsze: skopiowany plik .wasm musi
 * pasowac do wersji biblioteki z node_modules. Gdyby lezal w repozytorium
 * jako kopia, po aktualizacji sql.js cicho rozjechalby sie z kodem
 * ladujacym - a objawem bylby blad dopiero w przegladarce uzytkownika.
 *
 * Uruchamiane automatycznie po `npm install` i przed budowaniem wersji web.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ASSETS = [
  {
    from: join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    to: join(ROOT, 'public', 'sql', 'sql-wasm.wasm'),
    label: 'SQLite (sql.js) dla przegladarki',
  },
];

let failed = false;

for (const asset of ASSETS) {
  if (!existsSync(asset.from)) {
    console.warn(`[sync-web-assets] BRAK ZRODLA: ${asset.from}`);
    console.warn('[sync-web-assets] Czy na pewno wykonano "npm install"?');
    failed = true;
    continue;
  }

  mkdirSync(dirname(asset.to), { recursive: true });
  copyFileSync(asset.from, asset.to);
  console.log(
    `[sync-web-assets] ${asset.label}: ${(statSync(asset.to).size / 1024).toFixed(0)} KB`,
  );
}

if (failed) process.exitCode = 1;
