/**
 * Zaproszenie znajomego - wersja telefonowa.
 *
 * ============================ BEZPIECZENSTWO ============================
 * W linku jest WYLACZNIE kod znajomego - szesc znakow, ktore i tak pokazujemy
 * na ekranie i ktore mozna przepisac recznie. Nie ma tu tokenu sesji, nie ma
 * identyfikatora uzytkownika, nie ma nic prywatnego. Kod sam w sobie nie daje
 * dostepu do danych: pozwala jedynie WYSLAC zaproszenie, ktore druga strona
 * musi przyjac.
 * ========================================================================
 */
import { Share } from 'react-native';

/** Adres, ktory otworzy aplikacje u kogos, kto ja juz ma. */
export function inviteUrl(friendCode: string): string {
  return `repsy://add-friend?code=${encodeURIComponent(friendCode)}`;
}

/** Czy da sie w ogole udostepnic zaproszenie systemowym oknem. */
export function canShare(): boolean {
  return true;
}

export async function shareInvite(message: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch {
    // Zamkniecie okna udostepniania nie jest bledem.
  }
}
