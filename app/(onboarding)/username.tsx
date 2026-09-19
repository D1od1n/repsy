/**
 * Wybor nazwy uzytkownika.
 *
 * Unikalnosc egzekwuje baza (indeks unique), a nie sprawdzenie w aplikacji -
 * dzieki temu dwie osoby nie zajma tej samej nazwy w tej samej chwili.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/features/auth/authStore';

const USERNAME_PATTERN = /^[A-Za-z0-9._]{3,20}$/;

export default function UsernameScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  const router = useRouter();
  const setUsername = useAuthStore((state) => state.setUsername);
  const busy = useAuthStore((state) => state.busy);
  const errorKey = useAuthStore((state) => state.errorKey);

  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const valid = USERNAME_PATTERN.test(value);
  const showFormatError = touched && value.length > 0 && !valid;

  return (
    <Screen style={{ paddingHorizontal: theme.spacing.lg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <Text variant="title1">{t('onboarding.usernameTitle')}</Text>
        <View style={{ height: theme.spacing.md }} />
        <Text variant="body" color="textSecondary">
          {t('onboarding.usernameSubtitle')}
        </Text>

        <View style={{ height: theme.spacing.xl }} />

        <TextInput
          value={value}
          onChangeText={(text) => {
            setValue(text.trim());
            setTouched(true);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          maxLength={20}
          placeholder={t('onboarding.usernamePlaceholder')}
          placeholderTextColor={theme.colors.textTertiary}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.md,
            padding: theme.spacing.base,
            fontSize: 24,
            color: theme.colors.text,
          }}
        />

        {(showFormatError || errorKey !== null) && (
          <>
            <View style={{ height: theme.spacing.md }} />
            <Text variant="footnote" color="danger">
              {showFormatError ? t('onboarding.usernameInvalid') : t(errorKey ?? '')}
            </Text>
          </>
        )}
      </KeyboardAvoidingView>

      <View style={{ paddingBottom: theme.spacing.xl }}>
        <Button
          large
          title={t('onboarding.finish')}
          disabled={!valid}
          loading={busy}
          onPress={() => {
            void setUsername(value).then((ok) => {
              if (ok) router.replace('/(onboarding)/goal');
            });
          }}
        />
      </View>
    </Screen>
  );
}
