/**
 * Statystyki: dzien / tydzien / miesiac + rekordy zyciowe.
 */
import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BarChart, type BarDatum } from '../../src/components/BarChart';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { StatTile } from '../../src/components/StatTile';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAppStore } from '../../src/features/store/appStore';
import { periodRange } from '../../src/core/date/localDate';
import { computeRecords, summarizeDay, summarizePeriod } from '../../src/core/stats/stats';
import { goalProgressPercent } from '../../src/core/goals/goals';
import { dayOfMonthLabel, formatDuration, formatTime, weekdayLabel } from '../../src/core/format';

type Period = 'day' | 'week' | 'month';

export default function StatsScreen(): React.ReactElement {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  const [period, setPeriod] = useState<Period>('day');

  const today = useAppStore((state) => state.today);
  const workouts = useAppStore((state) => state.workouts);
  const goalFor = useAppStore((state) => state.goalFor);
  const streak = useAppStore(useShallow((state) => state.streak()));

  const range = useMemo(() => periodRange(period, today), [period, today]);

  const summary = useMemo(
    () => summarizePeriod(workouts, range.from, range.to, goalFor, today),
    [workouts, range, goalFor, today],
  );

  const records = useMemo(
    () => computeRecords(workouts, streak.longest),
    [workouts, streak.longest],
  );

  const chartData: BarDatum[] = useMemo(
    () =>
      summary.byDay.map((day) => ({
        label: period === 'month' ? dayOfMonthLabel(day.date) : weekdayLabel(day.date, i18n.language),
        value: day.totalReps,
        achieved: day.achieved,
      })),
    [summary.byDay, period, i18n.language],
  );

  return (
    <Screen scroll style={{ paddingHorizontal: theme.spacing.lg }}>
      <View style={{ paddingTop: theme.spacing.base }}>
        <Text variant="title1">{t('stats.title')}</Text>
      </View>

      <View style={{ height: theme.spacing.base }} />

      <SegmentedControl<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'day', label: t('stats.day') },
          { value: 'week', label: t('stats.week') },
          { value: 'month', label: t('stats.month') },
        ]}
      />

      <View style={{ height: theme.spacing.lg }} />

      {period === 'day' ? (
        <DayView />
      ) : (
        <>
          <Card>
            <Text variant="footnote" color="textSecondary">
              {t('stats.totalReps')}
            </Text>
            <Text variant="display" tabular>
              {summary.totalReps}
            </Text>
            <View style={{ height: theme.spacing.base }} />
            <BarChart data={chartData} goal={goalFor(today)} />
          </Card>

          <View style={{ height: theme.spacing.md }} />

          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <StatTile label={t('stats.workouts')} value={summary.workouts} />
            <StatTile label={t('stats.sets')} value={summary.sets} />
          </View>

          <View style={{ height: theme.spacing.md }} />

          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <StatTile label={t('stats.dailyAverage')} value={summary.dailyAverage} />
            <StatTile label={t('stats.bestSet')} value={summary.bestSet} />
          </View>

          <View style={{ height: theme.spacing.md }} />

          <StatTile
            wide
            label={t('stats.bestDay')}
            value={summary.bestDay?.totalReps ?? 0}
            caption={summary.bestDay?.date}
          />

          <View style={{ height: theme.spacing.md }} />

          <StatTile wide label={t('stats.duration')} value={formatDuration(summary.durationS)} />
        </>
      )}

      {/* ------------------------------------------------- rekordy */}
      <View style={{ height: theme.spacing.xxl }} />
      <Text variant="title3">{t('stats.records')}</Text>
      <View style={{ height: theme.spacing.md }} />

      <Card padded={false}>
        <RecordRow label={t('stats.recordDay')} value={records.bestDay} />
        <RecordRow label={t('stats.recordWorkout')} value={records.bestWorkout} />
        <RecordRow label={t('stats.recordSet')} value={records.bestSet} />
        <RecordRow
          label={t('stats.recordStreak')}
          value={`${records.longestStreak} ${t('common.days', { count: records.longestStreak })}`}
          last
        />
      </Card>
    </Screen>
  );
}

/** Widok pojedynczego dnia - inny uklad niz tydzien i miesiac. */
function DayView(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();

  const today = useAppStore((state) => state.today);
  const workouts = useAppStore((state) => state.workouts);
  const goalFor = useAppStore((state) => state.goalFor);

  const goal = goalFor(today);
  const summary = summarizeDay(workouts, today, goal);
  const ofDay = workouts.filter((workout) => workout.localDate === today);
  const sets = ofDay.flatMap((workout) => workout.sets.map((set) => set.reps));
  const percent = goalProgressPercent(summary.totalReps, goal);

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="display" tabular color={summary.achieved ? 'success' : 'text'}>
            {summary.totalReps}
          </Text>
          <Text variant="title3" color="textTertiary" tabular>
            {` / ${goal}`}
          </Text>
        </View>

        <Text variant="title3" color="textSecondary" tabular>
          {`${percent}%`}
        </Text>

        <View style={{ height: theme.spacing.md }} />
        <ProgressBar
          value={percent / 100}
          color={summary.achieved ? theme.colors.success : theme.colors.accent}
        />
      </Card>

      <View style={{ height: theme.spacing.md }} />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatTile label={t('stats.workouts')} value={summary.workouts} />
        <StatTile label={t('stats.sets')} value={summary.sets} />
      </View>

      <View style={{ height: theme.spacing.md }} />

      <StatTile wide label={t('stats.duration')} value={formatDuration(summary.durationS)} />

      {sets.length > 0 && (
        <>
          <View style={{ height: theme.spacing.md }} />
          <Card>
            <Text variant="footnote" color="textSecondary">
              {t('summary.setsBreakdown')}
            </Text>
            <View style={{ height: theme.spacing.sm }} />
            <Text variant="title3" tabular>
              {sets.join('  +  ')}
            </Text>
          </Card>
        </>
      )}

      {ofDay.length > 0 && (
        <>
          <View style={{ height: theme.spacing.md }} />
          <Card>
            <Text variant="footnote" color="textSecondary">
              {t('stats.workoutTimes')}
            </Text>
            <View style={{ height: theme.spacing.sm }} />
            <Text variant="body" tabular>
              {ofDay
                .map((workout) => `${formatTime(workout.startedAt)} — ${workout.totalReps}`)
                .join('\n')}
            </Text>
          </Card>
        </>
      )}

      {ofDay.length === 0 && (
        <>
          <View style={{ height: theme.spacing.md }} />
          <Text variant="callout" color="textTertiary" align="center">
            {t('stats.noData')}
          </Text>
        </>
      )}
    </>
  );
}

function RecordRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string | number;
  last?: boolean;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.base,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text variant="callout" color="textSecondary">
        {label}
      </Text>
      <Text variant="headline" tabular>
        {value}
      </Text>
    </View>
  );
}
