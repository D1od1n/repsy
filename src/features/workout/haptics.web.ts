/**
 * Krotka wibracja po zaliczonym powtorzeniu - wersja przegladarkowa.
 *
 * W przegladarce sluzy do tego Vibration API (navigator.vibrate).
 *
 * WAZNE OGRANICZENIE: Safari na iPhone NIE obsluguje navigator.vibrate i nie
 * zanosi sie na to, zeby to zmienil. Na iPhone potwierdzenie powtorzenia
 * pozostaje wiec wylacznie wzrokowe (licznik i kolor tla). Dlatego zamiast
 * udawac, ze wibracja dziala, udostepniamy hapticsSupported() - ekran
 * ustawien moze dzieki temu uczciwie ukryc przelacznik, ktory i tak nic
 * by nie zmienil.
 */

/** Dlugosc impulsu w ms - odpowiednik ImpactFeedbackStyle.Medium na telefonie. */
const REP_PULSE_MS = 35;

export function hapticsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function'
  );
}

/** Potwierdzenie zaliczonego powtorzenia. */
export function repFeedback(): void {
  if (!hapticsSupported()) return;
  try {
    navigator.vibrate(REP_PULSE_MS);
  } catch {
    // Niektore przegladarki odrzucaja wibracje bez wczesniejszej interakcji
    // uzytkownika. To nie jest powod, zeby przerywac trening.
  }
}
