/**
 * Service Worker - obsluga trybu offline.
 *
 * ============================== PRYWATNOSC ==============================
 * Ten worker NIGDY nie dotyka obrazu z kamery - nie ma do niego dostepu
 * (MediaStream zyje wylacznie w karcie, w elemencie <video>).
 *
 * Do pamieci podrecznej trafiaja WYLACZNIE pliki statyczne z naszego wlasnego
 * serwera: kod aplikacji, model rozpoznawania sylwetki, ikony. Odpowiedzi
 * z backendu (Supabase) sa jawnie POMIJANE - w cache nie ma i nie moze byc
 * zadnych danych uzytkownika ani tokenow sesji. Gdyby tu trafily, zostawalyby
 * na dysku po wylogowaniu.
 * ========================================================================
 *
 * Strategia:
 *   - nawigacja (wejscie na strone) -> najpierw siec, w razie braku cache.
 *     Dzieki temu po wdrozeniu nowej wersji dostajemy ja od razu, a bez
 *     internetu aplikacja i tak sie otwiera;
 *   - pliki statyczne -> najpierw cache. Sa niezmienne (maja skrot w nazwie),
 *     wiec nie ma czego odswiezac, a model wazy 4,6 MB i nie ma powodu
 *     pobierac go drugi raz;
 *   - wszystko obce (inny origin) -> przepuszczamy bez dotykania.
 */
'use strict';

// Zmiana wersji uniewaznia stara pamiec podreczna przy nastepnej aktywacji.
const CACHE_VERSION = 'repsy-v1';

/** Rozszerzenia, ktore traktujemy jako niezmienne pliki statyczne. */
const STATIC_PATTERN = /\.(?:js|css|wasm|bin|json|png|jpg|jpeg|svg|webp|woff2?|ttf|webmanifest)$/i;

self.addEventListener('install', (event) => {
  // Nowa wersja ma przejac kontrole od razu, bez czekania na zamkniecie kart.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Zapisow nie dotykamy nigdy - cache sluzy tylko do odczytu plikow.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Wszystko spoza naszego origin (przede wszystkim Supabase) idzie prosto
  // do sieci. To celowe: dane uzytkownika nie maja prawa wyladowac w cache.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    // Brak internetu: oddajemy ostatnia zapisana wersje strony. Gdyby jej
    // nie bylo (pierwsza wizyta offline), probujemy korzenia aplikacji.
    const cached = (await cache.match(request)) ?? (await cache.match('./'));
    if (cached !== undefined) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached !== undefined) return cached;

  const response = await fetch(request);
  // Odpowiedzi czesciowych (206) nie wolno zapisywac - przegladarka odtworzy
  // z nich uszkodzony plik.
  if (response.ok && response.status !== 206) cache.put(request, response.clone());
  return response;
}
