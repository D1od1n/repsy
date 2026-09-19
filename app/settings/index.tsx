/**
 * Ustawienia.
 */
import React from 'react';
import { Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';
import { useAuthStore } from '../../src/features/auth/authStore';
import { useSyncStore } from '../../src/features/sync/syncStore';
import type { LanguagePreference, ThemePreference } from '../../src/core/model';

export default function SettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const settings = useAppStore((state) => state.settings);
  const setSetting = useAppStore((state) => state.setSetting);
  const reminders = useAppStore((state) => state.reminders);
  const goalFor = useAppStore((state) => state.goalFor);
  const today = useAppStore((state) => state.today);

  const session = useAuthStore((state) => state.session);
  const pending = useSyncStore((state) => state.pending);
  const syncing = useSyncStore((state) => state.syncing);
  const sync = useSyncStore((state) => state.sync);

  const activeReminders = reminders.filter((reminder) => reminder.enabled).length;

  return (
    <Screen scroll style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ height: theme.spacing.base }} />

      {/* ------------------------------------------------- jezyk */}
      <SectionLabel>{t('settings.language')}</SectionLabel>
      <SegmentedControl<LanguagePreference>
        value={settings.language}
        onChange={(value) => void setSetting('language', value)}
        options={[
          { value: 'system', label: t('settings.languageSystem') },
          { value: 'pl', label: 'Polski' },
          { value: 'en', label: 'English' },
        ]}
      />

      {/* ------------------------------------------------- motyw */}
      <View style={{ height: theme.spacing.lg }} />
      <SectionLabel>{t('settings.theme')}</SectionLabel>
      <SegmentedControl<ThemePreference>
        value={settings.theme}
        onChange={(value) => void setSetting('theme', value)}
        options={[
          { value: 'system', label: t('settings.themeSystem') },
          { value: 'light', label: t('settings.themeLight') },
          { value: 'dark', label: t('settings.themeDark') },
        ]}
      />

      {/* ----------------------------------------------- trening */}
      <View style={{ height: theme.spacing.lg }} />
      <SectionLabel>{t('common.appName')}</SectionLabel>
      <Card padded={false}>
        <ListRow
          title={t('settings.goal')}
          value={String(goalFor(today))}
          onPress={() => router.push('/settings/goal')}
        />
        <ListRow
          title={t('settings.reminders')}
          value={settings.remindersEnabled ? String(activeReminders) : t('common.close')}
          onPress={() => router.push('/settings/reminders')}
        />
        <ListRow
          title={t('settings.haptics')}
          right={
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={(value) => void setSetting('hapticsEnabled', value)}
            />
          }
          last
        />
      </Card>

      {/* --------------------------------------------- techniczne */}
      <View style={{ height: theme.spacing.lg }} />
      <SectionLabel>{t('settings.sync')}</SectionLabel>
      <Card padded={false}>
        <ListRow
          title={t('settings.syncNow')}
          subtitle={
            pending > 0 ? t('settings.syncPending', { count: pending }) : t('settings.syncUpToDate')
          }
          value={syncing ? t('common.loading') : undefined}
          onPress={() => void sync(session?.user.id ?? null)}
        />
        <ListRow
          title={t('settings.debugOverlay')}
          subtitle={t('settings.debugOverlayHint')}
          right={
            <Switch
              value={settings.debugOverlay}
              onValueChange={(value) => void setSetting('debugOverlay', value)}
            />
          }
          last
        />
      </Card>

      {/* ---------------------------------------------- prywatnosc */}
      <View style={{ height: theme.spacing.lg }} />
      <Card padded={false}>
        <ListRow title={t('settings.privacy')} onPress={() => router.push('/settings/privacy')} last />
      </Card>

      <View style={{ height: theme.spacing.xl }} />
      <Text variant="caption" color="textTertiary" align="center">
        {`${t('settings.version')} 1.0.0`}
      </Text>
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }): React.ReactElement {
  const theme = useTheme();

  return (
    <Text
      variant="footnote"
      color="textSecondary"
      style={{ marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xs }}
    >
      {children}
    </Text>
  );
}
