#!/usr/bin/env node
/**
 * Generuje komplet ikon PWA do public/icons/.
 *
 * Dlaczego skryptem, a nie gotowymi plikami w repo:
 *   - ikona jest w calosci geometryczna, wiec jej "zrodlem" jest ten kod,
 *     a nie binarny PNG, ktorego nie da sie sensownie przejrzec w diffie;
 *   - zmiana koloru albo ksztaltu to zmiana jednej linijki i ponowne
 *     uruchomienie, zamiast grzebania w edytorze graficznym;
 *   - nie dokladamy zadnej zaleznosci - PNG sklada wbudowany w Node zlib.
 *
 * Znak: pusty "daszek" skierowany w dol nad pozioma kreska. Czytelny nawet
 * przy 32 px i oddaje sens aplikacji - zejdz w dol do podlogi i wroc.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BACKGROUND = [11, 11, 15]; // #0B0B0F - tlo aplikacji w trybie ciemnym
const ACCENT = [255, 107, 53]; // #FF6B35 - kolor akcentu

// ---------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'latin1');
  const body = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** @param rgba Buffer o dlugosci width*height*4 */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bitow na kanal
  ihdr[9] = 6; // RGBA
  // reszta (kompresja, filtr, przeplot) zostaje zerami - wartosci domyslne

  // Kazdy wiersz poprzedzamy bajtem typu filtra (0 = brak).
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- rysowanie

/** Odleglosc punktu od odcinka - podstawa rysowania grubych kresek. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Odleglosc od zaokraglonego prostokata (ujemna w srodku). */
function distanceToRoundedRect(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px - 0.5) - (halfW - radius);
  const qy = Math.abs(py - 0.5) - (halfH - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * @param size    bok obrazu w pikselach
 * @param options .maskable - znak mniejszy, bo Android moze przyciac ikone
 *                .transparent - tlo przezroczyste zamiast ciemnego
 */
function renderIcon(size, options = {}) {
  const { maskable = false, transparent = false } = options;
  const rgba = Buffer.alloc(size * size * 4);

  // Przy ikonie maskowalnej system moze wyciac nawet 20% z kazdej strony,
  // wiec znak musi zmiescic sie w bezpiecznym kole posrodku.
  const scale = maskable ? 0.62 : 0.84;
  const stroke = 0.085 * scale;

  // Wspolrzedne znaku w ukladzie 0..1, przeskalowane wzgledem srodka.
  const s = (v) => 0.5 + (v - 0.5) * scale;
  const chevron = [
    [s(0.3), s(0.34)],
    [s(0.5), s(0.56)],
    [s(0.7), s(0.34)],
  ];
  const floor = [
    [s(0.28), s(0.72)],
    [s(0.72), s(0.72)],
  ];

  // Wygladzanie: przejscie koloru na dlugosci mniej wiecej jednego piksela.
  const edge = 1.2 / size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;

      // --- tlo
      let color = BACKGROUND;
      let alpha = 1;

      if (transparent) {
        alpha = 0;
      } else if (!maskable) {
        // Zwykla ikona: zaokraglony kwadrat.
        const d = distanceToRoundedRect(px, py, 0.5, 0.5, 0.22);
        alpha = 1 - smoothstep(-edge, edge, d);
      }
      // Ikona maskowalna zostaje pelnym kwadratem - ksztalt nadaje system.

      // --- znak
      const dChevron = Math.min(
        distanceToSegment(px, py, ...chevron[0], ...chevron[1]),
        distanceToSegment(px, py, ...chevron[1], ...chevron[2]),
      );
      const dFloor = distanceToSegment(px, py, ...floor[0], ...floor[1]);
      const dMark = Math.min(dChevron, dFloor) - stroke / 2;

      const markAlpha = 1 - smoothstep(-edge, edge, dMark);
      if (markAlpha > 0) {
        color = mix(color, ACCENT, markAlpha);
        alpha = Math.max(alpha, markAlpha);
      }

      const i = (y * size + x) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }

  return encodePng(size, size, rgba);
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ------------------------------------------------------------------ main

const FILES = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, options: { maskable: true } },
  // iOS nie obsluguje ikon maskowalnych i nie zaokragla przezroczystosci -
  // apple-touch-icon musi byc pelnym, nieprzezroczystym kwadratem.
  { name: 'apple-touch-icon.png', size: 180, options: { maskable: true } },
  { name: 'favicon-32.png', size: 32 },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const file of FILES) {
  const png = renderIcon(file.size, file.options);
  writeFileSync(join(OUT_DIR, file.name), png);
  console.log(`[make-icons] ${file.name} (${file.size}x${file.size}, ${(png.length / 1024).toFixed(1)} KB)`);
}
console.log('[make-icons] Gotowe: public/icons/');
