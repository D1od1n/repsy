/**
 * Szablon dokumentu HTML dla wersji webowej.
 *
 * Expo Router uzywa tego pliku do zbudowania <html> wokol aplikacji. To jedyne
 * miejsce, w ktorym mozemy dodac naglowki bezpieczenstwa, manifest PWA i ikony.
 *
 * ================= DLACZEGO CSP JEST TU, A NIE W NAGLOWKACH ==================
 * Content-Security-Policy powinno przychodzic naglowkiem HTTP. GitHub Pages
 * NIE POZWALA ustawiac wlasnych naglowkow - nie ma tam zadnej konfiguracji
 * serwera. Zostaje <meta http-equiv>, ktore przegladarki respektuja dla
 * wiekszosci dyrektyw, ale NIE dla frame-ancestors (i nie da sie tak ustawic
 * X-Frame-Options ani HSTS).
 *
 * Skutek: ochrona przed osadzeniem strony w cudzej ramce jest slabsza niz
 * naglowkowa i opiera sie na skrypcie (public/frame-guard.js). Jest to opisane
 * w README w sekcji "Security limitations". Kto chce pelnych naglowkow, moze
 * wdrozyc to samo repozytorium na Cloudflare Pages - plik public/_headers
 * jest juz przygotowany.
 * =============================================================================
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Sciezka bazowa - ta sama, ktorej uzywa router (patrz app.config.js). */
const RAW_BASE = process.env.EXPO_PUBLIC_BASE_PATH ?? '';
const BASE =
  RAW_BASE === '' || RAW_BASE === '/' ? '/' : `/${RAW_BASE.replace(/^[/]+|[/]+$/g, '')}/`;

/**
 * Origin backendu, wpisywany do CSP w czasie budowania.
 *
 * Dzieki temu connect-src wskazuje konkretny projekt Supabase, a nie
 * "wszystkie domeny supabase.co". Gdy backend nie jest skonfigurowany,
 * polityka jest jeszcze ciasniejsza - aplikacja dziala wtedy lokalnie
 * i nie potrzebuje polaczen z niczym.
 */
function backendOrigin(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    return url === '' ? '' : new URL(url).origin;
  } catch {
    return '';
  }
}

function contentSecurityPolicy(): string {
  const backend = backendOrigin();
  // Supabase Realtime/Auth korzysta takze z WebSocket na tym samym hoscie.
  const connect = ["'self'", backend, backend === '' ? '' : backend.replace(/^https:/, 'wss:')]
    .filter((value) => value !== '')
    .join(' ');

  return [
    // Domyslnie wszystko tylko z wlasnego serwera.
    "default-src 'self'",

    // 'wasm-unsafe-eval' jest WYMAGANE: lokalna baza (expo-sqlite) dziala na
    // SQLite skompilowanym do WebAssembly. Bez tego aplikacja nie wystartuje.
    // Celowo NIE dajemy 'unsafe-eval' - to znacznie szersze uprawnienie.
    "script-src 'self' 'wasm-unsafe-eval'",

    // react-native-web generuje style w locie i wstrzykuje je do dokumentu,
    // wiec 'unsafe-inline' dla stylow jest nieuniknione. Ryzyko jest tu
    // nieporownanie mniejsze niz przy skryptach: styl nie wykona kodu.
    "style-src 'self' 'unsafe-inline'",

    // blob: jest potrzebne dla podgladu z kamery (MediaStream).
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",

    // Worker lokalnej bazy danych jest ladowany jako blob.
    "worker-src 'self' blob:",

    `connect-src ${connect}`,
    "font-src 'self'",
    "manifest-src 'self'",

    // Nic nie osadzamy i nie uzywamy wtyczek.
    "object-src 'none'",
    "frame-src 'none'",

    // Blokuje przejecie adresow wzglednych przez wstrzykniety <base>.
    "base-uri 'self'",

    // Formularzy nie wysylamy nigdzie poza wlasna domene.
    "form-action 'self'",

    // Wymusza https dla wszystkiego, co zostalo wpisane jako http.
    'upgrade-insecure-requests',
  ].join('; ');
}

export default function Root({ children }: PropsWithChildren): React.ReactElement {
  return (
    <html lang="pl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/*
          viewport-fit=cover pozwala tlu wejsc pod "notch" iPhone'a.
          Skalowanie zostawiamy wlaczone - jego blokowanie utrudnia zycie
          osobom slabiej widzacym, a nic nie wnosi.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy()} />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />

        {/*
          Kamera tylko dla tej strony, reszta czujnikow wylaczona.
          Jako <meta> dziala w Chrome; pelne Permissions-Policy wymaga
          naglowka HTTP (patrz komentarz na gorze pliku).
        */}
        <meta
          httpEquiv="Permissions-Policy"
          content="camera=(self), microphone=(), geolocation=(), payment=(), usb=()"
        />

        <title>Repsy</title>
        <meta
          name="description"
          content="Licznik pompek z kamery. Obraz jest analizowany lokalnie i nigdy nie opuszcza urzadzenia."
        />

        <link rel="manifest" href={`${BASE}manifest.webmanifest`} />
        <link rel="icon" type="image/png" sizes="32x32" href={`${BASE}icons/favicon-32.png`} />
        <link rel="apple-touch-icon" href={`${BASE}icons/apple-touch-icon.png`} />

        {/* Pasek stanu dopasowany do motywu systemowego. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FFFFFF" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B0B0F" />

        {/* Tryb pelnoekranowy po dodaniu do ekranu glownego na iPhone. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Repsy" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/*
          Skrypty trzymamy w osobnych plikach, a nie jako inline - dzieki temu
          CSP nie musi dopuszczac 'unsafe-inline' dla script-src.
        */}
        <script src={`${BASE}frame-guard.js`} defer />
        <script src={`${BASE}register-sw.js`} defer />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
