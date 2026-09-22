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
 * Tutaj uzywamy natywnego Alertu, a w dialogs.web.ts - okien przegladarki.
 */
import { Alert } from 'react-native';

export interface ConfirmOptions {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Czy akcja jest nieodwracalna - wplywa na wyglad przycisku na iOS. */
  destructive?: boolean;
}

/** Krotka informacja bez wyboru. */
export function notify(message: string): void {
  Alert.alert(message);
}

/** Pytanie tak/nie. Zwraca true, gdy uzytkownik potwierdzil. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(options.message, undefined, [
      { text: options.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmLabel,
        style: options.destructive === true ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
