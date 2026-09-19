/**
 * Przechowywanie sesji uzytkownika - wersja przegladarkowa.
 *
 * Metro wybiera ten plik zamiast secureStorage.ts, gdy buduje wersje web.
 *
 * ========================= UCZCIWIE O BEZPIECZENSTWIE =========================
 * Na telefonie sesja lezy w Keychain / EncryptedSharedPreferences, do ktorych
 * inne aplikacje nie maja dostepu. W przegladarce TAKIEGO MIEJSCA NIE MA.
 * Kazdy magazyn dostepny z JavaScriptu (localStorage, sessionStorage, IndexedDB,
 * zmienna w pamieci) jest tak samo czytelny dla skryptu wykonanego w tym samym
 * origin. Nie da sie tego obejsc bibliotekami - to wlasciwosc modelu
 * bezpieczenstwa przegladarki, nie niedoróbka tego kodu.
 *
 * Wniosek praktyczny: prawdziwa ochrona tokenu to NIEDOPUSZCZENIE do wykonania
 * obcego skryptu, czyli Content-Security-Policy, brak wstrzykiwania HTML
 * i walidacja wejscia. Szyfrowanie wartosci w localStorage byloby teatrem -
 * klucz musialby lezec obok, w tym samym miejscu.
 *
 * Wybor: localStorage. Uzasadnienie wobec alternatyw:
 *   - sessionStorage   -> wylogowanie po kazdym zamknieciu karty; przy aplikacji
 *                         uruchamianej z ekranu glownego telefonu to uciazliwe,
 *                         a poziom ochrony przed XSS jest DOKLADNIE taki sam;
 *   - tylko pamiec RAM -> wylogowanie przy kazdym odswiezeniu, ten sam poziom
 *                         ochrony przed XSS (skrypt czyta zmienna tak samo latwo);
 *   - ciasteczko httpOnly -> jedyna opcja faktycznie odporna na odczyt z JS, ale
 *                         wymaga wlasnego serwera ustawiajacego naglowek
 *                         Set-Cookie. Przy statycznym hostingu (GitHub Pages)
 *                         i logowaniu po stronie klienta jest nieosiagalna.
 *
 * Ograniczenie jest opisane w README w sekcji "Security limitations".
 * ==============================================================================
 *
 * ============================== PRYWATNOSC ==============================
 * Tu trafia wylacznie token sesji Supabase. Zaden obraz z kamery ani zadna
 * klatka nie jest i nie moze byc tutaj zapisana.
 * ========================================================================
 */

/**
 * Zapasowy magazyn w pamieci.
 *
 * Safari w trybie prywatnym potrafi rzucic wyjatkiem przy zapisie do
 * localStorage, a uzytkownik moze miec zablokowane dane witryn. Wtedy aplikacja
 * ma dzialac dalej - po prostu bez zapamietania logowania miedzy odswiezeniami.
 */
const memoryFallback = new Map<string, string>();

/** Czy localStorage jest realnie uzywalny (samo `typeof` nie wystarcza). */
function usableStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Zapis probny: w trybie prywatnym samo istnienie obiektu nie oznacza,
    // ze zapis sie powiedzie.
    const probe = '__repsy_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export const secureStorageAdapter = {
  getItem(key: string): string | null {
    const store = usableStorage();
    if (store === null) return memoryFallback.get(key) ?? null;
    try {
      return store.getItem(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },

  setItem(key: string, value: string): void {
    const store = usableStorage();
    if (store === null) {
      memoryFallback.set(key, value);
      return;
    }
    try {
      store.setItem(key, value);
    } catch {
      // Najczesciej przepelniony limit magazynu - lepiej dzialac dalej
      // z sesja w pamieci niz wywalic cala aplikacje.
      memoryFallback.set(key, value);
    }
  },

  removeItem(key: string): void {
    memoryFallback.delete(key);
    const store = usableStorage();
    if (store === null) return;
    try {
      store.removeItem(key);
    } catch {
      // Nie ma czego ratowac - wpis i tak nie bedzie uzyty.
    }
  },
};
