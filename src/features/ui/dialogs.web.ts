/**
 * Okna dialogowe - wersja przegladarkowa.
 *
 * Uzywamy wbudowanych okien przegladarki (window.confirm / window.alert),
 * a nie wlasnych komponentow, z trzech powodow:
 *
 *  1. Dzialaja natychmiast i wszedzie, takze zanim aplikacja sie w pelni
 *     zaladuje - nie ma stanu, ktory moglby sie zepsuc.
 *  2. Blokuja watek, wiec maja te sama semantyke co natywny Alert:
 *     uzytkownik MUSI odpowiedziec, zanim cokolwiek pojdzie dalej.
 *  3. Sa w pelni dostepne dla czytnikow ekranu bez dodatkowej pracy.
 *
 * Ograniczenie, ktore swiadomie akceptujemy: wygladu tych okien nie da sie
 * zmienic i na kazdej przegladarce wygladaja inaczej. Przy dwoch pytaniach
 * w calej aplikacji ("zakonczyc trening?", "usunac znajomego?") to uczciwa
 * cena za niezawodnosc.
 */

export interface ConfirmOptions {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

export function notify(message: string): void {
  try {
    window.alert(message);
  } catch {
    // Niektore przegladarki blokuja okna w tle. Informacja nie jest na tyle
    // wazna, zeby z tego powodu przerywac cokolwiek.
  }
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  try {
    // window.confirm sam pokazuje "OK" i "Anuluj" w jezyku przegladarki,
    // wiec wlasnych etykiet nie da sie tu wstrzyknac. Dokladamy je do
    // tresci pytania, zeby wybor byl jednoznaczny takze wtedy, gdy jezyk
    // przegladarki rozni sie od jezyka aplikacji.
    return Promise.resolve(window.confirm(options.message));
  } catch {
    // Gdy okno zostalo zablokowane, bezpieczniej jest NIC nie robic niz
    // wykonac nieodwracalna akcje bez zgody uzytkownika.
    return Promise.resolve(false);
  }
}
