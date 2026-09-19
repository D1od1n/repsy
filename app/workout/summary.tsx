/**
 * Podsumowanie po zakonczonym treningu.
 */
import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { StatTile } from '../../src/components/StatTile';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';
import { useWorkoutResultStore } from '../../src/features/workout/workoutResultStore';
import { goalProgressPercent } from '../../src/core/goals/goals';
import { formatDuration } from '../../src/core/format';

export default function WorkoutSummaryScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const workout = useWorkoutResultStore((state) => state.result);
  const summary = useAppStore(useShallow((state) => state.todaySummary()));

  if (workout === null) {
    return (
      <Screen style={{ padding: theme.spacing.lg, justifyContent: 'center' }}>
        <Text variant="title3" align="center">
          {t('summary.title')}
        </Text>
        <View style={{ height: theme.spacing.xl }} />
        <Button title={t('common.done')} onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  const percent = goalProgressPercent(summary.totalReps, summary.goal);

  return (
    <Screen scroll style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ alignItems: 'center', marginTop: theme.spacing.xxl }}>
        <Text variant="footnote" color="textSecondary">
          {t('summary.saved')}
        </Text>
        <View style={{ height: theme.spacing.sm }} />
        <Text variant="display" tabular>
          {workout.totalReps}
        </Text>
        <Text variant="title3" color="textSecondary">
          {t('common.reps', { count: workout.totalReps })}
        </Text>
      </View>

      <View style={{ height: theme.spacing.xxl }} />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatTile label={t('summary.sets')} value={workout.sets.length} />
        <StatTile label={t('summary.duration')} value={formatDuration(workout.durationS)} />
      </View>

      <View style={{ height: theme.spacing.md }} />

      <Card>
        <Text variant="footnote" color="textSecondary">
          {t('summary.setsBreakdown')}
        </Text>
        <View style={{ height: theme.spacing.sm }} />
        <Text variant="title3" tabular>
          {workout.sets.map((set) => set.reps).join('  +  ')}
        </Text>
      </Card>

      <View style={{ height: theme.spacing.md }} />

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="footnote" color="textSecondary">
            {t('summary.goalProgress')}
          </Text>
          <Text variant="footnote" color="textSecondary" tabular>
            {`${summary.totalReps} / ${summary.goal}`}
          </Text>
        </View>
        <View style={{ height: theme.spacing.sm }} />
        <ProgressBar
          value={percent / 100}
          color={summary.achieved ? theme.colors.success : theme.colors.accent}
        />
        {summary.achieved && (
          <>
            <View style={{ height: theme.spacing.sm }} />
            <Text variant="headline" color="success">
              {t('home.goalReached')}
            </Text>
          </>
        )}
      </Card>

      <View style={{ height: theme.spacing.xxl }} />

      <Button large title={t('common.done')} onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
