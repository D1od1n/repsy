/**
 * Powitanie i logowanie.
 *
 * Google jest droga glowna - dziala na iPhonie i na Androidzie, i nie wymaga
 * platnego konta Apple Developer. Przycisk Apple pokazujemy tylko wtedy, gdy
 * urzadzenie faktycznie obsluguje Sign in with Apple.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/authStore';
import { isBackendConfigured } from '../../src/data/api/supabase';

export default function WelcomeScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signInWithApple = useAuthStore((state) => state.signInWithApple);
  const continueWithoutAccount = useAuthStore((state) => state.continueWithoutAccount);
  const appleAvailable = useAuthStore((state) => state.appleAvailable);
  const busy = useAuthStore((state) => state.busy);
  const errorKey = useAuthStore((state) => state.errorKey);
  const clearError = useAuthStore((state) => state.clearError);
  const router = useRouter();

  useEffect(() => clearError, [clearError]);

  const backendReady = isBackendConfigured();

  /**
   * Przejscie do kolejnego kroku powitania.
   *
   * NavigationGuard celowo NIE przekierowuje wewnatrz onboardingu - inaczej
   * cofalby uzytkownika na pierwszy krok przy kazdym przejsciu dalej.
   * Dlatego kazdy ekran powitania sam wskazuje nastepny, tak jak robia to
   * ekrany nazwy uzytkownika i celu.
   */
  const goNext = (): void => {
    const status = useAuthStore.getState().status;

    // Nieudane albo anulowane logowanie zostawia stan "signed-out".
    // Wtedy zostajemy na miejscu, zeby uzytkownik zobaczyl komunikat
    // bledu, zamiast zostac wepchnietym dalej mimo niepowodzenia.
    if (status === 'needs-username') router.replace('/onboarding/username');
    else if (status === 'ready' || status === 'local-only') router.replace('/onboarding/goal');
  };

  return (
    <Screen style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="display">💪</Text>
        <View style={{ height: theme.spacing.lg }} />
        <Text variant="title1">{t('onboarding.welcomeTitle')}</Text>
        <View style={{ height: theme.spacing.md }} />
        <Text variant="body" color="textSecondary">
          {t('onboarding.welcomeSubtitle')}
        </Text>

        <View style={{ height: theme.spacing.xl }} />

        <Text variant="footnote" color="textTertiary">
          {t('onboarding.privacyNote')}
        </Text>
      </View>

      <View style={{ paddingBottom: theme.spacing.xl }}>
        {errorKey !== null && (
          <>
            <Text variant="footnote" color="danger" align="center">
              {t(errorKey)}
            </Text>
            <View style={{ height: theme.spacing.md }} />
          </>
        )}

        {backendReady ? (
          <>
            {appleAvailable && (
              <>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={
                    theme.isDark
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={theme.radius.full}
                  style={{ height: 56 }}
                  onPress={() => void signInWithApple().then(goNext)}
                />
                <View style={{ height: theme.spacing.md }} />
              </>
            )}

            <Button
              large
              title={t('onboarding.signInGoogle')}
              loading={busy}
              onPress={() => void signInWithGoogle().then(goNext)}
            />

            <View style={{ height: theme.spacing.md }} />
            <Text variant="caption" color="textTertiary" align="center">
              {t('onboarding.signInHint')}
            </Text>
          </>
        ) : (
          <>
            {/* Backend jeszcze nieskonfigurowany - pozwalamy korzystac lokalnie,
                zeby dalo sie przetestowac aplikacje od razu po instalacji. */}
            <Text variant="footnote" color="textSecondary" align="center">
              {t('errors.supabaseNotConfigured')}
            </Text>
            <View style={{ height: theme.spacing.md }} />
            <Button
              large
              title={t('onboarding.finish')}
              onPress={() => {
                continueWithoutAccount();
                router.replace('/onboarding/goal');
              }}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
