/**
 * Ochrona przed osadzeniem strony w cudzej ramce (clickjacking).
 *
 * ======================== UCZCIWIE O SILE TEGO ROZWIAZANIA ========================
 * Wlasciwym narzedziem jest naglowek HTTP - `Content-Security-Policy:
 * frame-ancestors 'none'` albo `X-Frame-Options: DENY`. Przegladarka blokuje
 * wtedy osadzenie ZANIM cokolwiek sie wykona, i nie da sie tego obejsc.
 *
 * GitHub Pages nie pozwala ustawiac wlasnych naglowkow, a <meta http-equiv>
 * dla frame-ancestors jest przez przegladarki IGNOROWANE (to swiadoma decyzja
 * w standardzie, nie przeoczenie). Ten skrypt jest wiec rozwiazaniem
 * zastepczym i jest SLABSZY:
 *   - dziala dopiero po wykonaniu JavaScriptu,
 *   - atakujacy moze go wylaczyc atrybutem `sandbox` na swoim <iframe>.
 *
 * Mimo to warto go miec: podnosi poprzeczke i zatrzymuje najprostsze proby.
 * Kto potrzebuje prawdziwej ochrony, powinien wdrozyc aplikacje na hosting
 * pozwalajacy ustawiac naglowki - plik public/_headers jest juz gotowy
 * pod Cloudflare Pages i Netlify.
 * ==================================================================================
 */
(function () {
  'use strict';

  if (window.self === window.top) return;

  // Zaslaniamy tresc natychmiast, jeszcze zanim sprobujemy sie wydostac -
  // gdyby przejscie sie nie powiodlo, nie ma czego klikac.
  const style = document.createElement('style');
  style.textContent = 'html{visibility:hidden!important;background:#0B0B0F!important}';
  document.documentElement.appendChild(style);

  try {
    // Przy obcym origin przegladarka zwykle to zablokuje - i o to chodzi,
    // bo tresc pozostaje zaslonieta.
    window.top.location = window.self.location.href;
  } catch {
    // Celowo nic nie robimy: strona zostaje ukryta, co jest bezpiecznym
    // zachowaniem domyslnym.
  }
})();
