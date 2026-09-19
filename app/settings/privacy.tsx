/**
 * Ekran prywatnosci.
 *
 * Wymagane zdanie o kamerze jest tu pokazane wprost, w jezyku uzytkownika.
 */
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function PrivacyScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Screen scroll style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ height: theme.spacing.base }} />

      <Card>
        <Text variant="headline">{t('privacy.statement')}</Text>
      </Card>

      <View style={{ height: theme.spacing.md }} />

      <Text variant="body" color="textSecondary">
        {t('privacy.details')}
      </Text>

      <View style={{ height: theme.spacing.xl }} />

      <Text variant="title3">{t('privacy.whatWeSync')}</Text>
      <View style={{ height: theme.spacing.sm }} />
      <Text variant="body" color="textSecondary">
        {t('privacy.whatWeSyncBody')}
      </Text>

      <View style={{ height: theme.spacing.lg }} />

      <Text variant="title3">{t('privacy.whatStaysLocal')}</Text>
      <View style={{ height: theme.spacing.sm }} />
      <Text variant="body" color="textSecondary">
        {t('privacy.whatStaysLocalBody')}
      </Text>
    </Screen>
  );
}
