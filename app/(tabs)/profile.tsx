/**
 * Profil: kim jestem i jakie mam rekordy.
 */
import React from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StatTile } from '../../src/components/StatTile';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';
import { useAuthStore } from '../../src/features/auth/authStore';

export default function ProfileScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const profile = useAuthStore((state) => state.profile);
  const status = useAuthStore((state) => state.status);
  const signOut = useAuthStore((state) => state.signOut);

  const streak = useAppStore((state) => state.streak());
  const records = useAppStore((state) => state.records());

  const confirmSignOut = (): void => {
    Alert.alert(t('profile.signOutConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  };

  return (
    <Screen scroll style={{ paddingHorizontal: theme.spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: theme.spacing.base,
        }}
      >
        <Text variant="title1">{t('profile.title')}</Text>
        <Text
          variant="title3"
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
        >
          ⚙️
        </Text>
      </View>

      <View style={{ height: theme.spacing.xl }} />

      <View style={{ alignItems: 'center' }}>
        <Text variant="display">{profile?.avatarEmoji ?? '💪'}</Text>
        <View style={{ height: theme.spacing.sm }} />
        <Text variant="title2">{profile?.username ?? t('common.appName')}</Text>
        {profile !== null && (
          <Text variant="footnote" color="textTertiary" tabular>
            {profile.friendCode}
          </Text>
        )}
      </View>

      <View style={{ height: theme.spacing.xxl }} />

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text variant="title1" tabular>
              {`🔥 ${streak.current}`}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {t('profile.currentStreak')}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text variant="title1" tabular>
              {streak.longest}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {t('profile.longestStreak')}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ height: theme.spacing.md }} />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatTile label={t('profile.totalReps')} value={records.totalReps} />
        <StatTile label={t('profile.totalWorkouts')} value={records.totalWorkouts} />
      </View>

      <View style={{ height: theme.spacing.md }} />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatTile label={t('profile.bestSet')} value={records.bestSet} />
        <StatTile label={t('profile.bestDay')} value={records.bestDay} />
      </View>

      <View style={{ height: theme.spacing.md }} />

      <StatTile wide label={t('profile.completedDays')} value={streak.completedDays} />

      <View style={{ height: theme.spacing.xxl }} />

      {status === 'ready' ? (
        <Button variant="ghost" title={t('profile.signOut')} onPress={confirmSignOut} />
      ) : (
        <Text variant="footnote" color="textTertiary" align="center">
          {t('errors.supabaseNotConfigured')}
        </Text>
      )}
    </Screen>
  );
}
