/**
 * Ekran glowny.
 *
 * Ma odpowiadac na jedno pytanie, z odleglosci reki: ile mi jeszcze zostalo?
 * Stad ogromna liczba na gorze i minimum wszystkiego innego.
 */
import React, { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ManualRepsModal } from '../../src/components/ManualRepsModal';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAppStore } from '../../src/features/store/appStore';
import { useAuthStore } from '../../src/features/auth/authStore';
import { useSyncStore } from '../../src/features/sync/syncStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { goalProgressPercent, remainingToGoal } from '../../src/core/goals/goals';

export default function HomeScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const today = useAppStore((state) => state.today);
  const workouts = useAppStore((state) => state.workouts);
  const summary = useAppStore(useShallow((state) => state.todaySummary()));
  const streak = useAppStore(useShallow((state) => state.streak()));
  const addManualReps = useAppStore((state) => state.addManualReps);
  const refresh = useAppStore((state) => state.refresh);

  const session = useAuthStore((state) => state.session);
  const sync = useSyncStore((state) => state.sync);

  const [manualOpen, setManualOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const todaySets = workouts
    .filter((workout) => workout.localDate === today)
    .flatMap((workout) => workout.sets.map((set) => set.reps));

  const remaining = remainingToGoal(summary.totalReps, summary.goal);
  const achieved = summary.achieved;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await sync(session?.user.id ?? null);
    await refresh();
    setRefreshing(false);
  }, [refresh, session, sync]);

  return (
    <Screen
      scroll
      style={{ paddingHorizontal: theme.spacing.lg }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
      }
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: theme.spacing.base,
        }}
      >
        <Text variant="title3">{t('common.appName')}</Text>
        <Text
          variant="title3"
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
        >
          ⚙️
        </Text>
      </View>

      {/* ---------------------------------------------- licznik dnia */}
      <View style={{ alignItems: 'center', marginTop: theme.spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="display" tabular color={achieved ? 'success' : 'text'}>
            {summary.totalReps}
          </Text>
          <Text variant="title2" color="textTertiary" tabular>
            {` / ${summary.goal}`}
          </Text>
        </View>

        <View style={{ height: theme.spacing.sm }} />

        <Text variant="headline" color={achieved ? 'success' : 'textSecondary'}>
          {achieved ? t('home.goalReached') : t('home.goalRemaining', { count: remaining })}
        </Text>

        <View style={{ height: theme.spacing.base, width: '100%' }} />
        <ProgressBar
          value={goalProgressPercent(summary.totalReps, summary.goal) / 100}
          color={achieved ? theme.colors.success : theme.colors.accent}
        />
      </View>

      {/* ---------------------------------------------------- streak */}
      {streak.current > 0 && (
        <View style={{ alignItems: 'center', marginTop: theme.spacing.xl }}>
          <Text variant="title3">
            {`🔥 ${streak.current} ${t('common.days', { count: streak.current })}`}
          </Text>
          {streak.daysToMilestone > 0 && (
            <Text variant="footnote" color="textTertiary">
              {t('streak.toMilestone', {
                count: streak.daysToMilestone,
                milestone: streak.nextMilestone,
              })}
            </Text>
          )}
        </View>
      )}

      {/* --------------------------------------------------- akcje */}
      <View style={{ marginTop: theme.spacing.xxl }}>
        <Button
          large
          title={t('home.startWorkout')}
          onPress={() => router.push('/workout')}
        />
        <View style={{ height: theme.spacing.md }} />
        <Button
          variant="ghost"
          title={t('home.addManually')}
          onPress={() => setManualOpen(true)}
        />
      </View>

      {/* ------------------------------------------ dzisiejsze serie */}
      <View style={{ marginTop: theme.spacing.xxl }}>
        <Text variant="footnote" color="textSecondary">
          {t('home.todaySets')}
        </Text>
        <View style={{ height: theme.spacing.sm }} />

        <Card>
          {todaySets.length === 0 ? (
            <Text variant="callout" color="textTertiary">
              {t('home.noWorkoutsToday')}
            </Text>
          ) : (
            <Text variant="title3" tabular>
              {todaySets.join('  +  ')}
            </Text>
          )}
        </Card>
      </View>

      <ManualRepsModal
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={async (reps) => {
          await addManualReps(reps);
          setManualOpen(false);
        }}
      />
    </Screen>
  );
}
