/**
 * Zaproszenie znajomego - wersja przegladarkowa.
 *
 * Przewaga nad wersja telefonowa: link jest zwyklym adresem https, wiec
 * dziala u KAZDEGO - takze u kogos, kto nie ma jeszcze aplikacji. Otworzy
 * mu sie po prostu strona, a po zalogowaniu zaproszenie zostanie przyjete.
 * Schemat repsy:// wymagal wczesniejszej instalacji.
 *
 * ============================ BEZPIECZENSTWO ============================
 * W linku jest WYLACZNIE kod znajomego - szesc znakow, ktore i tak pokazujemy
 * na ekranie. Nie ma tu tokenu sesji, identyfikatora uzytkownika ani niczego
 * prywatnego. Sam kod nie daje dostepu do danych: pozwala jedynie WYSLAC
 * zaproszenie, ktore druga strona musi przyjac.
 *
 * Kod jest wstawiany przez encodeURIComponent, wiec nawet spreparowana
 * wartosc nie wyjdzie poza parametr zapytania.
 * ========================================================================
 */
import { basePath } from '../web/basePath';

/** Adres zaproszenia - zwykla strona aplikacji z kodem w parametrze. */
export function inviteUrl(friendCode: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${basePath()}?add-friend=${encodeURIComponent(friendCode)}`;
}

/**
 * Czy przegladarka udostepnia systemowe okno udostepniania.
 * Na telefonach zwykle tak, na komputerach czesto nie - wtedy kopiujemy
 * tresc do schowka, zamiast udawac, ze cos sie wydarzylo.
 */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function shareInvite(message: string): Promise<void> {
  try {
    if (canShare()) {
      await navigator.share({ text: message });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(message);
    }
  } catch {
    // Anulowanie okna udostepniania albo odmowa dostepu do schowka
    // nie sa bledami, ktore warto pokazywac uzytkownikowi.
  }
}
