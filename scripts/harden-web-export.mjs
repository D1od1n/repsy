#!/usr/bin/env node
/**
 * Domyka polityke CSP w wyeksportowanej wersji webowej.
 *
 * PROBLEM
 * Expo przy renderowaniu statycznym wstawia do kazdej strony maleńki skrypt
 * inline (`globalThis.__EXPO_ROUTER_HYDRATE__=true;`). Nasza polityka CSP
 * nie dopuszcza skryptow inline, wiec przegladarka go blokuje i aplikacja
 * w ogole sie nie uruchamia.
 *
 * ROZWIAZANIE - i dlaczego akurat takie
 * Najprostszym wyjsciem byloby dopisanie 'unsafe-inline' do script-src. Tego
 * NIE ROBIMY: to zdejmuje najwazniejsza czesc ochrony przed XSS, bo pozwala
 * wykonac dowolny skrypt wstrzykniety w tresc strony. Zamiast tego liczymy
 * skrot SHA-256 kazdego skryptu inline i wpisujemy go do polityki. Przegladarka
 * wykona wtedy dokladnie te skrypty i zadnego innego.
 *
 * Skrypt jest przy okazji kontrola: wypisuje kazdy znaleziony skrypt inline,
 * wiec gdyby w przyszlosci pojawil sie tam kod, ktorego nikt sie nie spodziewa,
 * bedzie to widoczne w logu builda zamiast po cichu przejsc dalej.
 *
 * Uruchamiane automatycznie przez `npm run build:web`.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, process.argv[2] ?? 'dist');

/** Zbiera wszystkie pliki .html w drzewie katalogow. */
function htmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...htmlFiles(full));
    else if (entry.endsWith('.html')) found.push(full);
  }
  return found;
}

/** Zamienia encje HTML z powrotem na znaki - CSP jest w atrybucie. */
function decodeEntities(value) {
  return value
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function encodeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

if (!existsSync(OUT_DIR)) {
  console.error(`[harden-web] Nie ma katalogu ${OUT_DIR}. Najpierw uruchom eksport.`);
  process.exit(1);
}

const files = htmlFiles(OUT_DIR);
if (files.length === 0) {
  console.error('[harden-web] Nie znaleziono zadnego pliku .html - eksport sie nie powiodl?');
  process.exit(1);
}

const seenScripts = new Map(); // hash -> tresc skryptu
let patched = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');

  // Skrypty BEZ atrybutu src, czyli te wykonywane z tresci strony.
  const inlineRe = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const hashes = new Set();

  let match;
  while ((match = inlineRe.exec(html)) !== null) {
    const code = match[1];
    if (code.trim() === '') continue;

    // Skrot liczymy z DOKLADNEJ tresci miedzy znacznikami - tak jak robi
    // to przegladarka. Kazda spacja ma znaczenie.
    const hash = createHash('sha256').update(code, 'utf8').digest('base64');
    hashes.add(`'sha256-${hash}'`);
    seenScripts.set(hash, code.trim());
  }

  if (hashes.size === 0) continue;

  const cspRe = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;
  const found = html.match(cspRe);
  if (found === null) {
    console.warn(`[harden-web] UWAGA: ${file} ma skrypt inline, ale nie ma polityki CSP.`);
    continue;
  }

  const policy = decodeEntities(found[2]);
  const updated = policy.replace(/script-src ([^;]*)/, (whole, sources) => {
    const missing = [...hashes].filter((h) => !sources.includes(h));
    return missing.length === 0 ? whole : `script-src ${sources.trim()} ${missing.join(' ')}`;
  });

  if (updated === policy) continue;

  writeFileSync(file, html.replace(cspRe, `$1${encodeAttribute(updated)}$3`));
  patched += 1;
}

console.log(`[harden-web] Znalezione skrypty inline (${seenScripts.size}):`);
for (const [hash, code] of seenScripts) {
  const preview = code.length > 70 ? `${code.slice(0, 70)}...` : code;
  console.log(`  sha256-${hash}`);
  console.log(`    ${preview}`);
}
console.log(`[harden-web] Polityka CSP uzupelniona w ${patched} z ${files.length} plikow HTML.`);

// ---------------------------------------------------------------------------
// GitHub Pages: nieznana sciezka zwraca 404.html. Kopia strony glownej sprawia,
// ze gleboki link do trasy, ktorej nie ma jako plik, i tak uruchomi aplikacje.
// Przy renderowaniu statycznym wiekszosc tras ma juz wlasny plik, ale ta kopia
// zabezpiecza przypadki takie jak adres z parametrem zaproszenia.
// ---------------------------------------------------------------------------
const indexHtml = join(OUT_DIR, 'index.html');
if (existsSync(indexHtml)) {
  copyFileSync(indexHtml, join(OUT_DIR, '404.html'));
  console.log('[harden-web] Utworzono 404.html (kopia index.html dla GitHub Pages).');
}

// GitHub Pages domyslnie przepuszcza tresc przez Jekyll, ktory POMIJA katalogi
// zaczynajace sie od podkreslenia - a tam leza wszystkie pliki aplikacji
// (_expo/). Bez tego pliku strona wdroży sie "pusta" i nic nie zadziala.
writeFileSync(join(OUT_DIR, '.nojekyll'), '');
console.log('[harden-web] Utworzono .nojekyll (inaczej GitHub Pages pomija katalog _expo).');
