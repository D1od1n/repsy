import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../src/theme/ThemeProvider';

export default function SettingsLayout(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { color: theme.colors.text },
        headerTintColor: theme.colors.accent,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('settings.title') }} />
      <Stack.Screen name="goal" options={{ title: t('settings.goal') }} />
      <Stack.Screen name="reminders" options={{ title: t('settings.reminders') }} />
      <Stack.Screen name="privacy" options={{ title: t('privacy.title') }} />
    </Stack>
  );
}
