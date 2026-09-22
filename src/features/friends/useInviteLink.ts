/**
 * Obsluga linku zapraszajacego: repsy://add-friend?code=7KQ4M2
 *
 * Link zadziala u kogos, kto ma juz zainstalowana aplikacje. Dlatego tresc
 * zaproszenia zawsze zawiera takze sam kod - osoba bez aplikacji moze go po
 * prostu wpisac recznie po instalacji.
 */
import { useCallback, useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { addFriend } from '../../data/api/friendsApi';
import { isBackendConfigured } from '../../data/api/supabase';
import { notify } from '../ui/dialogs';

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
    const parsed = Linking.parse(url);
    if (parsed.hostname !== 'add-friend' && parsed.path !== 'add-friend') return null;

    const code = parsed.queryParams?.code;
    if (typeof code !== 'string') return null;

    const normalized = code.trim().toUpperCase();
    return /^[A-Z0-9]{4,12}$/.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function useInviteLink(onHandled: () => void): void {
  const { t } = useTranslation();

  const handleUrl = useCallback(
    async (url: string | null) => {
      if (url === null || !isBackendConfigured()) return;

      const code = parseInviteCode(url);
      if (code === null) return;

      try {
        const result = await addFriend(code);
        notify(t(MESSAGE_KEYS[result] ?? 'errors.generic'));
        onHandled();
      } catch {
        notify(t('errors.network'));
      }
    },
    [onHandled, t],
  );

  useEffect(() => {
    // Aplikacja uruchomiona przez kliniecie w link.
    void Linking.getInitialURL().then((url) => void handleUrl(url));

    // Link kliniety, gdy aplikacja juz dzialala.
    const subscription = Linking.addEventListener('url', (event) => {
      void handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [handleUrl]);
}
