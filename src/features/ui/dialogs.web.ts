/**
 * Okna dialogowe - wersja przegladarkowa.
 *
 * Zostalo tu tylko `notify` - krotka informacja bez wyboru (np. "kod
 * skopiowany"). Uzywamy window.alert, bo nawet gdy przegladarka je stlumi,
 * nic waznego sie nie dzieje: uzytkownik po prostu nie zobaczy potwierdzenia
 * czynnosci, ktora i tak sie wykonala.
 *
 * Pytan tak/nie tu NIE obslugujemy - tam stlumione okno oznaczaloby akcje,
 * ktorej nie da sie wykonac. Od tego jest components/ConfirmDialog.
 */

export function notify(message: string): void {
  try {
    window.alert(message);
  } catch {
    // Niektore przegladarki blokuja okna w tle. Informacja nie jest na tyle
    // wazna, zeby z tego powodu przerywac cokolwiek.
  }
}

// Potwierdzen (pytan tak/nie) tu NIE MA i nie powinno byc.
//
// Byly - najpierw na Alert z react-native-web (martwa atrapa), potem na
// window.confirm (bywa tlumione bez mozliwosci wykrycia). Obie wersje
// konczyly sie tym samym zgloszeniem: "przycisk nie dziala".
//
// Potwierdzenia robi teraz components/ConfirmDialog - zwykly komponent,
// ktory wyglada tak samo na obu platformach i daje sie przetestowac.
