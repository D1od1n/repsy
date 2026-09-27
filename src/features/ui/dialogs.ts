/**
 * Okna dialogowe - wersja telefonowa.
 *
 * Modul istnieje z konkretnego powodu: `Alert` z react-native-web to ATRAPA.
 * Jego cale cialo to:
 *
 *     class Alert { static alert() {} }
 *
 * Czyli w przegladarce wywolanie Alert.alert() nie robi DOSLOWNIE NIC i nie
 * zglasza bledu. Przycisk "Zakoncz trening" wygladal przez to na zepsuty -
 * okno potwierdzenia nigdy sie nie pojawialo, wiec nie dalo sie zakonczyc
 * sesji. Zglosil to uzytkownik z telefonu.
 *
 * Zostalo tu tylko `notify` - krotka informacja bez wyboru, gdzie milczace
 * pominiecie nie jest grozne. Pytania tak/nie obsluguje ConfirmDialog.
 */
import { Alert } from 'react-native';

/** Krotka informacja bez wyboru. */
export function notify(message: string): void {
  Alert.alert(message);
}


// Potwierdzen (pytan tak/nie) tu NIE MA i nie powinno byc.
//
// Byly - najpierw na Alert z react-native-web (martwa atrapa), potem na
// window.confirm (bywa tlumione bez mozliwosci wykrycia). Obie wersje
// konczyly sie tym samym zgloszeniem: "przycisk nie dziala".
//
// Potwierdzenia robi teraz components/ConfirmDialog - zwykly komponent,
// ktory wyglada tak samo na obu platformach i daje sie przetestowac.
