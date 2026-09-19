/**
 * Obsluga linku zapraszajacego - wersja przegladarkowa.
 *
 * Adres ma postac:  https://.../?add-friend=7KQ4M2
 *
 * ============================ BEZPIECZENSTWO ============================
 * Kod z adresu jest danymi od obcej osoby, wiec traktujemy go jak wejscie
 * niezaufane:
 *   - sprawdzamy wzorcem /^[A-Z0-9]{4,12}$/ ZANIM cokolwiek z nim zrobimy,
 *   - nigdzie go nie wstawiamy jako HTML (aplikacja renderuje wylacznie
 *     tekst, nie ma dangerouslySetInnerHTML),
 *   - po obsluzeniu USUWAMY go z adresu, zeby nie zostal w historii
 *     przegladarki ani nie wykonal sie drugi raz po odswiezeniu.
 * Sam kod nie daje dostepu do danych - pozwala tylko wyslac zaproszenie.
 * ========================================================================
 */
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { addFriend } from '../../data/api/friendsApi';
import { isBackendConfigured } from '../../data/api/supabase';

const MESSAGE_KEYS: Record<string, string> = {
  sent: 'friends.sent',
  accepted: 'friends.sent',
  already_friends: 'friends.alreadyFriends',
  self: 'friends.cannotAddSelf',
  not_found: 'friends.notFound',
};

/** Wyciaga kod znajomego z adresu, albo zwraca null. */
export function parseInviteCode(url: string): string | null {
  try {
    // Baza jest potrzebna dla adresow wzglednych; dla pelnych jest ignorowana.
    const parsed = new URL(url, 'https://repsy.invalid');

    const code =
      parsed.searchParams.get('add-friend') ??
      // Zgodnosc ze schematem telefonowym: repsy://add-friend?code=XXXX
      (parsed.hostname === 'add-friend' || parsed.pathname.endsWith('/add-friend')
        ? parsed.searchParams.get('code')
        : null);

    if (code === null) return null;

    const normalized = code.trim().toUpperCase();
    return /^[A-Z0-9]{4,12}$/.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

/** Usuwa parametr zaproszenia z paska adresu, nie przeladowujac strony. */
function stripInviteParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('add-friend')) return;

    url.searchParams.delete('add-friend');
    window.history.replaceState(null, '', url.toString());
  } catch {
    // Brak dostepu do History API nie jest powodem do przerywania.
  }
}

export function useInviteLink(onHandled: () => void): void {
  const { t } = useTranslation();

  const handleUrl = useCallback(
    async (url: string | null) => {
      if (url === null || !isBackendConfigured()) return;

      const code = parseInviteCode(url);
      if (code === null) return;

      // Kasujemy parametr OD RAZU, zanim pojdzie zapytanie do serwera.
      // Inaczej odswiezenie strony w trakcie wyslaloby zaproszenie drugi raz.
      stripInviteParam();

      try {
        const result = await addFriend(code);
        window.alert(t(MESSAGE_KEYS[result] ?? 'errors.generic'));
        onHandled();
      } catch {
        window.alert(t('errors.network'));
      }
    },
    [onHandled, t],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void handleUrl(window.location.href);
  }, [handleUrl]);
}
