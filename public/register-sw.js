/**
 * Rejestracja Service Workera.
 *
 * Osobny plik zamiast skryptu w HTML-u jest celowy: dzieki temu polityka CSP
 * nie musi dopuszczac 'unsafe-inline' dla script-src, co byloby powaznym
 * oslabieniem ochrony przed XSS.
 *
 * Service Worker dziala WYLACZNIE po https (albo na localhost). To wymaganie
 * przegladarki, nie nasze - i ta sama zasada dotyczy kamery.
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  // Adres sw.js wyliczamy z adresu TEGO pliku, a nie z adresu strony.
  // Adres strony bywa rozny (aplikacja jednostronicowa zmienia go przy
  // nawigacji, a GitHub Pages potrafi obsluzyc glebokie linki przez
  // 404.html), wiec liczenie sciezki wzgledem niego dawaloby raz dobry,
  // a raz zly wynik. Adres skryptu jest zawsze ten sam.
  var current = document.currentScript;
  var swUrl =
    current !== null && current.src !== ''
      ? new URL('sw.js', current.src).href
      : new URL('sw.js', document.baseURI).href;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swUrl).catch(function () {
      // Brak trybu offline nie jest powodem, zeby cokolwiek pokazywac
      // uzytkownikowi - aplikacja dziala normalnie, tylko wymaga internetu.
    });
  });
})();
