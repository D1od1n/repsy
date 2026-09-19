/**
 * Podpowiedz "dodaj do ekranu glownego" - wersja przegladarkowa.
 *
 * ==================== NIE UDAJEMY INSTALATORA SYSTEMOWEGO ====================
 * Na Androidzie przegladarka sama udostepnia zdarzenie beforeinstallprompt.
 * Przechwytujemy je i pokazujemy przycisk, ktory wywoluje PRAWDZIWE okno
 * przegladarki. To nie jest podrobka - decyzje i caly interfejs instalacji
 * pokazuje system, my tylko wybieramy moment.
 *
 * Na iPhone takiego API nie ma i nie bedzie. Zamiast rysowac falszywy przycisk
 * "Zainstaluj", ktory niczego by nie zrobil, pokazujemy instrukcje: gdzie
 * kliknac w Safari. To jedyna uczciwa opcja.
 * ============================================================================
 *
 * Gdy aplikacja jest juz uruchomiona z ekranu glownego, komponent znika sam.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from './Card';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Zdarzenie Chrome, ktorego nie ma w standardowych typach DOM.
 * Opisujemy tylko to, czego faktycznie uzywamy.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Czy strona dziala juz jako aplikacja dodana do ekranu glownego. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  // Safari na iOS uzywa wlasnej, niestandardowej flagi.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;

  // iPad od iPadOS 13 podaje sie za komputer Mac, wiec sprawdzamy dodatkowo
  // obecnosc dotyku - bez tego instrukcja nie pokazalaby sie na iPadzie.
  const ua = navigator.userAgent;
  return /iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function InstallHint(): React.ReactElement | null {
  const theme = useTheme();
  const { t } = useTranslation();

  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => isStandalone());

  useEffect(() => {
    const onBeforeInstall = (event: Event): void => {
      // Bez tego Chrome pokazalby wlasny pasek w losowym momencie.
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = (): void => setHidden(true);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden) return null;

  const ios = isIos();
  // Poza Androidem z gotowym zdarzeniem i poza iPhonem nie mamy nic sensownego
  // do powiedzenia - na komputerze instalacja jest opcjonalna i przegladarka
  // proponuje ja sama.
  if (!ios && installEvent === null) return null;

  return (
    <Card>
      <Text variant="headline">{t('install.title')}</Text>
      <View style={{ height: theme.spacing.sm }} />
      <Text variant="footnote" color="textSecondary">
        {ios ? t('install.iosSteps') : t('install.androidBody')}
      </Text>

      {installEvent !== null && (
        <>
          <View style={{ height: theme.spacing.base }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              // Od tej chwili interfejs nalezy do przegladarki.
              void installEvent.prompt().then(() => setInstallEvent(null));
            }}
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.full,
              paddingVertical: theme.spacing.md,
              alignItems: 'center',
            }}
          >
            <Text variant="callout" color="accentText">
              {t('install.action')}
            </Text>
          </Pressable>
        </>
      )}
    </Card>
  );
}
